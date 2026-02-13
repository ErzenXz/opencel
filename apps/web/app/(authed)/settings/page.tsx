"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Github, Keyboard, Moon, User } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Me = { id: string; email: string; is_instance_admin?: boolean };

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [ghApp, setGhApp] = useState<{
    configured: boolean;
    app_id?: string;
  } | null>(null);
  const [ghMe, setGhMe] = useState<{
    connected: boolean;
    scopes?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = (await apiFetch("/api/me")) as Me;
        setMe(m);
      } catch {
        // ignore
      }
      try {
        const st = (await apiFetch(
          "/api/integrations/github/app/status"
        )) as { configured: boolean; app_id?: string };
        setGhApp(st);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
      try {
        const me = (await apiFetch("/api/github/me")) as {
          connected: boolean;
          scopes?: string;
        };
        setGhMe(me);
      } catch {
        setGhMe({ connected: false });
      }
    })();
  }, []);

  const base =
    typeof window !== "undefined" ? window.location.host : "<base-domain>";
  const webhookURL = `https://${base}/api/webhooks/github`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Manage your account, integrations, and preferences.
        </p>
      </div>

      {/* Profile / Account */}
      <div className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-sm font-medium text-white">Account</h2>
              <p className="text-xs text-[#888]">Your account information.</p>
            </div>
          </div>
          {me?.is_instance_admin && (
            <Badge className="bg-[#0070f3]/10 text-[#0070f3] hover:bg-[#0070f3]/20">
              Admin
            </Badge>
          )}
        </div>
        <div className="px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                Email
              </span>
              <p className="mt-1 font-mono text-sm text-[#ededed]">
                {me?.email || "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                User ID
              </span>
              <p className="mt-1 font-mono text-xs text-[#888]">
                {me?.id || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Account */}
      <div className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-4">
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-sm font-medium text-white">
                GitHub Account
              </h2>
              <p className="text-xs text-[#888]">
                OAuth token for repository browsing and imports.
              </p>
            </div>
          </div>
          <div>
            {ghMe?.connected ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                Connected
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-[#333] text-[#888]"
              >
                Not connected
              </Badge>
            )}
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {ghMe?.connected && ghMe.scopes && (
                <p className="text-sm text-[#888]">
                  Scopes:{" "}
                  <span className="font-mono text-xs text-[#ededed]">
                    {ghMe.scopes}
                  </span>
                </p>
              )}
              {!ghMe?.connected && (
                <p className="text-sm text-[#888]">
                  Connect your GitHub account to browse repositories and import
                  projects.
                </p>
              )}
            </div>
            <div>
              {ghMe?.connected ? (
                <Button
                  variant="outline"
                  className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                  onClick={async () => {
                    try {
                      await apiFetch("/api/auth/github/disconnect", {
                        method: "POST",
                        body: "{}",
                      });
                      toast.success("Disconnected GitHub");
                      setGhMe({ connected: false });
                    } catch (e: any) {
                      toast.error(String(e?.message || e));
                    }
                  }}
                >
                  Disconnect
                </Button>
              ) : (
                <Button asChild className="gap-2">
                  <a href="/api/auth/github/start?return_to=/settings">
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GitHub App */}
      <div className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-4">
          <div>
            <h2 className="text-sm font-medium text-white">GitHub App</h2>
            <p className="text-xs text-[#888]">
              Used for deploy hooks and installation tokens.
            </p>
          </div>
          <div>
            {ghApp?.configured ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                Configured
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-[#333] text-[#888]"
              >
                Not configured
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-4 px-6 py-4">
          {ghApp?.app_id && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#888]">App ID:</span>
              <span className="font-mono text-[#ededed]">
                {ghApp.app_id}
              </span>
            </div>
          )}
          {!ghApp?.configured && (
            <div className="rounded-md border border-yellow-800/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-200">
              GitHub App is not configured. Go to{" "}
              <Link href="/admin" className="underline underline-offset-4">
                Admin
              </Link>{" "}
              to set it up.
            </div>
          )}
        </div>
      </div>

      {/* Webhook URL */}
      <div className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">Webhook URL</h2>
          <p className="text-xs text-[#888]">
            Set this in your GitHub App configuration.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-[#333] bg-black px-3 py-2 font-mono text-sm text-[#ededed]">
              {webhookURL}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 border-[#333] bg-transparent hover:bg-[#111]"
              onClick={() => {
                navigator.clipboard.writeText(webhookURL);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-4">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-sm font-medium text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-[#888]">
                Use keyboard shortcuts for faster navigation.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { keys: "⌘K", label: "Command palette" },
              { keys: "⌘/", label: "Show all shortcuts" },
              { keys: "G → D", label: "Go to Dashboard" },
              { keys: "G → P", label: "Go to Projects" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-md border border-[#222] px-3 py-2">
                <span className="text-sm text-[#ededed]">{s.label}</span>
                <kbd className="rounded border border-[#333] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-[#888]">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#555]">
            Press{" "}
            <kbd className="rounded border border-[#333] bg-[#111] px-1 font-mono text-[10px] text-[#888]">
              ⌘/
            </kbd>{" "}
            anywhere to see all keyboard shortcuts.
          </p>
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-4">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-sm font-medium text-white">Appearance</h2>
              <p className="text-xs text-[#888]">Theme preference.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-3">
            {[
              { id: "dark", label: "Dark", active: true },
              { id: "light", label: "Light", active: false },
              { id: "system", label: "System", active: false },
            ].map((theme) => (
              <button
                key={theme.id}
                className={`rounded-md px-4 py-2 text-sm transition-colors ${
                  theme.active
                    ? "bg-white text-black"
                    : "bg-[#1a1a1a] text-[#888] hover:text-white"
                }`}
                onClick={() => {
                  if (!theme.active) {
                    toast.info("Theme switching coming soon");
                  }
                }}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
