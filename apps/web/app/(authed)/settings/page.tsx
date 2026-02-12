"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Github, Link2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [ghApp, setGhApp] = useState<{ configured: boolean; app_id?: string } | null>(null);
  const [ghMe, setGhMe] = useState<{ connected: boolean; scopes?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = (await apiFetch("/api/integrations/github/app/status")) as { configured: boolean; app_id?: string };
        setGhApp(st);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
      try {
        const me = (await apiFetch("/api/github/me")) as { connected: boolean; scopes?: string };
        setGhMe(me);
      } catch {
        setGhMe({ connected: false });
      }
    })();
  }, []);

  const base = typeof window !== "undefined" ? window.location.host : "<base-domain>";
  const webhookURL = `https://${base}/api/webhooks/github`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Integrations</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Connect your GitHub user for imports and verify GitHub App instance configuration.</p>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Github className="h-4 w-4" />GitHub account</CardTitle>
          <CardDescription>OAuth token is used for repository browsing and imports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {ghMe?.connected ? <Badge variant="secondary">OAuth connected</Badge> : <Badge variant="outline">OAuth not connected</Badge>}
            {ghMe?.connected && ghMe.scopes ? <span className="text-sm text-zinc-400">Scopes: {ghMe.scopes}</span> : null}
            <div className="ml-auto">
              {ghMe?.connected ? (
                <Button
                  variant="outline"
                  className="border-white/15 bg-transparent hover:bg-white/5"
                  onClick={async () => {
                    try {
                      await apiFetch("/api/auth/github/disconnect", { method: "POST", body: "{}" });
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
                <Button asChild>
                  <a href="/api/auth/github/start?return_to=/settings">Connect GitHub</a>
                </Button>
              )}
            </div>
          </div>

          <Separator className="bg-white/10" />

          <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-400">
            <div className="mb-1 flex items-center gap-2 text-zinc-200"><Link2 className="h-3.5 w-3.5" />Webhook URL</div>
            <div className="font-mono text-xs break-all">{webhookURL}</div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-400">
            <div className="mb-1 flex items-center gap-2 text-zinc-200"><Webhook className="h-3.5 w-3.5" />GitHub App status</div>
            <div className="flex flex-wrap items-center gap-2">
              {ghApp?.configured ? <Badge variant="secondary">App configured</Badge> : <Badge variant="outline">App not configured</Badge>}
              {ghApp?.app_id ? <span className="text-xs text-zinc-500">App ID: {ghApp.app_id}</span> : null}
            </div>
            {!ghApp?.configured ? (
              <div className="mt-2 text-xs">
                Configure this from <Link className="text-zinc-200 underline" href="/admin">Admin</Link>.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
