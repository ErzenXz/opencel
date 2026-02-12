"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  FolderKanban,
  Import,
  LayoutGrid,
  LogOut,
  Settings,
  Shield,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgID, setOrgID] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const activeOrg = useMemo(() => orgs.find((o) => o.id === orgID) || null, [orgs, orgID]);

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
        const st = (await apiFetch("/api/setup/status")) as { needs_setup: boolean };
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
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#a1a1aa]">
        <div className="text-sm">Loading workspace...</div>
      </main>
    );
  }

  if (!me) return null;

  const nav = [
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/import", label: "Import", icon: Import },
    { href: "/orgs", label: "Organizations", icon: Building2 },
    { href: "/settings", label: "Settings", icon: Settings },
    ...(me.is_instance_admin ? [{ href: "/admin", label: "Admin", icon: Shield }] : [])
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[252px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#0d0d0d] lg:block">
          <div className="flex h-16 items-center border-b border-white/10 px-4">
            <Link href="/projects" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/5">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              OpenCel
              <Badge className="ml-1 rounded-sm border-white/20 bg-transparent text-[10px] font-medium text-zinc-300">BETA</Badge>
            </Link>
          </div>

          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <div className="px-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">Workspace</div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 w-full justify-between px-2 text-left">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">{activeOrg ? activeOrg.name : "Select org"}</div>
                        <div className="truncate text-[11px] text-zinc-500">{activeOrg ? activeOrg.role : "No role"}</div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[240px]" align="start">
                    {orgs.map((o) => (
                      <DropdownMenuItem
                        key={o.id}
                        onClick={() => {
                          setOrgID(o.id);
                          setStoredOrgID(o.id);
                          router.refresh();
                        }}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{o.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{o.role}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <nav className="space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={[
                      "group flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors",
                      active
                        ? "border-white/20 bg-white/[0.08] text-white"
                        : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-100"
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/10 p-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-zinc-500">Signed in as</div>
              <div className="mt-1 truncate text-sm text-zinc-200">{me.email}</div>
              <Button variant="ghost" className="mt-2 h-8 w-full justify-start px-2 text-zinc-300 hover:text-white" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-center gap-2 lg:hidden">
                <Link href="/projects" className="flex items-center gap-2 text-sm font-semibold">
                  <LayoutGrid className="h-4 w-4" />
                  OpenCel
                </Link>
              </div>

              <div className="hidden max-w-md flex-1 lg:block">
                <Input
                  readOnly
                  value="Search commands (coming soon)"
                  className="h-9 border-white/10 bg-white/[0.04] text-zinc-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="hidden border-white/20 text-zinc-300 md:inline-flex">
                  <BadgeCheck className="mr-1.5 h-3 w-3" />
                  {activeOrg ? activeOrg.name : "Workspace"}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 gap-2 rounded-md border border-white/10 px-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                        {me.email.slice(0, 1).toUpperCase()}
                      </div>
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0d0d0d] px-2 py-2 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {nav.slice(0, 5).map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={[
                  "flex flex-col items-center justify-center rounded-md py-1.5 text-[11px]",
                  active ? "bg-white/10 text-white" : "text-zinc-500"
                ].join(" ")}
              >
                <Icon className="mb-1 h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
