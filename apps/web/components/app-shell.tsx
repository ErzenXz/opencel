"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Database,
  FolderKanban,
  Home,
  Import,
  LogOut,
  MapPin,
  Menu,
  Search,
  Server,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/command-palette";
import { SystemStatusBanner } from "@/components/system-status";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts";

export type Me = { id: string; email: string; is_instance_admin?: boolean };
export type Org = { id: string; slug: string; name: string; role: string };

const ORG_KEY = "opencel_org_id";

export function getStoredOrgID() {
  try {
    return localStorage.getItem(ORG_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredOrgID(id: string) {
  try {
    localStorage.setItem(ORG_KEY, id);
  } catch {
    // ignore
  }
}

function OrgAvatar({
  name,
  size = "sm",
}: {
  name: string | undefined;
  size?: "sm" | "md";
}) {
  const letter = (name?.charAt(0) || "?").toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-[#333] bg-[#111] font-semibold text-[#ededed]",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
      )}
    >
      {letter}
    </div>
  );
}

function UserAvatar({ email }: { email: string }) {
  const letter = (email?.charAt(0) || "?").toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#333] bg-[#111] text-xs font-semibold text-white transition-colors hover:border-[#555]">
      {letter}
    </div>
  );
}

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgID, setOrgID] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === orgID) || null,
    [orgs, orgID]
  );

  useEffect(() => {
    (async () => {
      try {
        const m = (await apiFetch("/api/me")) as Me;
        setMe(m);
      } catch {
        router.replace("/login");
        return;
      }
      try {
        const st = (await apiFetch("/api/setup/status")) as {
          needs_setup: boolean;
        };
        if (st.needs_setup) {
          router.replace("/setup");
          return;
        }
      } catch {
        // ignore
      }
      try {
        const os = (await apiFetch("/api/orgs")) as Org[];
        setOrgs(os);
        const stored = getStoredOrgID();
        const pick = os.find((o) => o.id === stored)?.id || os[0]?.id || "";
        setOrgID(pick);
        if (pick) setStoredOrgID(pick);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-white" />
          <span className="text-sm text-[#888]">Loading…</span>
        </div>
      </main>
    );
  }

  if (!me) return null;

  const nav = [
    { href: "/dashboard", label: "Overview", icon: Home },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/databases", label: "Databases", icon: Database },
    { href: "/locations", label: "Locations", icon: MapPin },
    { href: "/nodes", label: "Nodes", icon: Server },
    { href: "/import", label: "Import", icon: Import },
    { href: "/orgs", label: "Teams", icon: Building2 },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(me.is_instance_admin
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <SystemStatusBanner />
      <CommandPalette me={me} />
      <KeyboardShortcutsDialog />

      <header className="sticky top-0 z-40 border-b border-[#1f1f1f] bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-6">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 text-white transition-colors hover:text-[#ededed]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12h4l3 -8 4 16 3 -8h4" />
            </svg>
            <span className="text-sm font-semibold tracking-tight">
              OpenCel
            </span>
          </Link>

          <span className="h-5 w-px shrink-0 bg-[#2a2a2a]" aria-hidden />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#ededed] transition-colors hover:bg-[#141414]">
                <OrgAvatar name={activeOrg?.name} />
                <span className="max-w-[160px] truncate">
                  {activeOrg ? activeOrg.name : "Select team"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#666]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px]">
              {orgs.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    o.id === orgID && "bg-[#141414]"
                  )}
                  onClick={() => {
                    setOrgID(o.id);
                    setStoredOrgID(o.id);
                    router.refresh();
                  }}
                >
                  <OrgAvatar name={o.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{o.name}</div>
                    <div className="truncate text-xs text-[#666]">{o.role}</div>
                  </div>
                  {o.id === orgID && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/orgs" className="text-[#ededed]">
                  Manage teams
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav className="ml-1 hidden h-full items-center gap-0.5 md:flex">
            {nav.map((n) => {
              const active =
                pathname === n.href || pathname.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative flex h-full items-center px-3 text-[13px] transition-colors",
                    active ? "text-white" : "text-[#888] hover:text-[#ededed]"
                  )}
                >
                  {n.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-white"
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                  })
                );
              }}
              className="hidden items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#666] transition-colors hover:border-[#3a3a3a] hover:text-[#888] sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search…</span>
              <kbd className="ml-2 rounded border border-[#2a2a2a] bg-[#111] px-1 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>

            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#888] transition-colors hover:bg-[#141414] hover:text-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Account">
                  <UserAvatar email={me.email} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                <div className="px-2 py-1.5">
                  <div className="truncate text-xs text-[#888]">
                    Signed in as
                  </div>
                  <div className="truncate text-sm text-[#ededed]">
                    {me.email}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="text-[#ededed]">
                    Account settings
                  </Link>
                </DropdownMenuItem>
                {me.is_instance_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="text-[#ededed]">
                      Instance admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-[#ededed]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#1f1f1f] bg-black md:hidden">
            <nav className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3">
              {nav.map((n) => {
                const active =
                  pathname === n.href || pathname.startsWith(`${n.href}/`);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-[#141414] text-white"
                        : "text-[#ededed] hover:bg-[#141414]"
                    )}
                  >
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}
