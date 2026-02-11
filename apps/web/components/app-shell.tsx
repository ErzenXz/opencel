"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!me) return null;

  const nav = [
    { href: "/orgs", label: "Organizations" },
    { href: "/projects", label: "Projects" },
    { href: "/settings", label: "Settings" },
    ...(me?.is_instance_admin ? [{ href: "/admin", label: "Admin" }] : [])
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(70%_80%_at_100%_0%,hsl(var(--primary)/0.06),transparent)]">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/projects" className="font-semibold tracking-tight">
              OpenCel
            </Link>
            <span className="hidden rounded-md border border-border/70 bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              self-hosted cloud
            </span>
            <div className="h-5 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <span className="max-w-[220px] truncate">{activeOrg ? activeOrg.name : "Select org"}</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {orgs.map((o) => (
                  <DropdownMenuItem
                    key={o.id}
                    onClick={() => {
                      setOrgID(o.id);
                      setStoredOrgID(o.id);
                      // Refresh the current page data.
                      router.refresh();
                    }}
                  >
                    <span className="truncate">{o.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{o.role}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex gap-1.5">
              <Link href="/import">
                <Plus className="h-3.5 w-3.5" />
                New
              </Link>
            </Button>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={[
                  "text-sm rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors",
                  pathname === n.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                ].join(" ")}
              >
                {n.label}
              </Link>
            ))}
            <div className="text-xs text-muted-foreground hidden sm:block">{me.email}</div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
