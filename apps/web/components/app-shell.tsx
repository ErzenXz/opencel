"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  Clock,
  Database,
  FolderKanban,
  Home,
  Import,
  LogOut,
  Menu,
  Plug,
  ScrollText,
  Search,
  Settings,
  Shield,
  Wallet,
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
import { FeedbackWidget } from "@/components/feedback-widget";
import { SystemStatusBanner } from "@/components/system-status";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts";
import { NotificationBell } from "@/components/notification-bell";

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

function VercelLogo() {
  return (
    <svg height="22" viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
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
          <span className="text-sm text-[#888]">Loading...</span>
        </div>
      </main>
    );
  }

  if (!me) return null;

  const nav = [
    { href: "/dashboard", label: "Overview", icon: Home },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/storage", label: "Storage", icon: Database },
    { href: "/integrations", label: "Integrations", icon: Plug },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/cron", label: "Cron", icon: Clock },
    { href: "/usage", label: "Usage", icon: Wallet },
    { href: "/import", label: "Import", icon: Import },
    { href: "/orgs", label: "Teams", icon: Building2 },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(me.is_instance_admin
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      {/* System Status Banner */}
      <SystemStatusBanner />

      {/* Command Palette */}
      <CommandPalette me={me} />
      <KeyboardShortcutsDialog />

      {/* ─── Top Navigation Bar ─── */}
      <header className="sticky top-0 z-50 border-b border-[#333] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-6">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center text-white transition-opacity hover:opacity-80"
          >
            <VercelLogo />
          </Link>

          {/* Separator */}
          <svg
            className="shrink-0 text-[#333]"
            width="24"
            height="32"
            viewBox="0 0 24 32"
            fill="none"
          >
            <line
              x1="14.5"
              y1="2"
              x2="8.5"
              y2="30"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Org Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-[#ededed] transition-colors hover:bg-[#1a1a1a]">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#333] to-[#555] text-[10px] font-bold uppercase">
                  {activeOrg?.name?.charAt(0) || "?"}
                </div>
                <span className="max-w-[140px] truncate">
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
                    o.id === orgID && "bg-[#1a1a1a]"
                  )}
                  onClick={() => {
                    setOrgID(o.id);
                    setStoredOrgID(o.id);
                    router.refresh();
                  }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#333] to-[#555] text-[10px] font-bold uppercase">
                    {o.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{o.name}</div>
                    <div className="truncate text-xs text-[#666]">{o.role}</div>
                  </div>
                  {o.id === orgID && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Desktop Nav Tabs */}
          <nav className="ml-2 hidden h-full items-center gap-0.5 md:flex">
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
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="ml-auto flex items-center gap-2">
            {/* ⌘K search trigger */}
            <button
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                  })
                );
              }}
              className="hidden items-center gap-2 rounded-md border border-[#333] bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#666] transition-colors hover:border-[#555] hover:text-[#888] sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="ml-2 rounded border border-[#333] bg-[#111] px-1 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* Mobile menu toggle */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#888] transition-colors hover:bg-[#1a1a1a] hover:text-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white ring-1 ring-[#333] transition-all hover:ring-[#555]">
                  {me.email.slice(0, 1).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                <div className="px-2 py-2">
                  <div className="truncate text-sm text-[#ededed]">
                    {me.email}
                  </div>
                  <div className="text-xs text-[#666]">
                    {activeOrg?.name || "No team"}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="gap-2 text-red-400 focus:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="border-t border-[#333] bg-black px-6 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {nav.map((n) => {
                const Icon = n.icon;
                const active =
                  pathname === n.href || pathname.startsWith(`${n.href}/`);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-[#1a1a1a] text-white"
                        : "text-[#888] hover:bg-[#111] hover:text-[#ededed]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
              <div className="my-2 h-px bg-[#333]" />
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-[#111]"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        {children}
      </main>

      {/* Feedback Widget */}
      <FeedbackWidget />
    </div>
  );
}
