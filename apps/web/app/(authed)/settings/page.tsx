"use client";

import { useEffect, useState } from "react";
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
        const st = (await apiFetch("/api/integrations/github/app/status")) as any;
        setGhApp(st);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
      try {
        const me = (await apiFetch("/api/github/me")) as any;
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure integrations and review install hints.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GitHub</CardTitle>
          <CardDescription>Connect your GitHub account for repo import. Instance-level App config lives in Admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {ghMe?.connected ? <Badge variant="secondary">OAuth connected</Badge> : <Badge variant="outline">OAuth not connected</Badge>}
            {ghMe?.connected && ghMe?.scopes ? <span className="text-sm text-muted-foreground">Scopes: {ghMe.scopes}</span> : null}
            <div className="ml-auto">
              {ghMe?.connected ? (
                <Button
                  variant="outline"
                  size="sm"
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
                <Button asChild size="sm">
                  <a href="/api/auth/github/start?return_to=/settings">Connect</a>
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Webhook URL</div>
            <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs break-all">{webhookURL}</div>
            <div className="text-xs text-muted-foreground">
              Create a GitHub App, subscribe to the <span className="font-mono">push</span> event, and set the webhook secret to match{" "}
              <span className="font-mono">OPENCEL_GITHUB_WEBHOOK_SECRET</span>.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Server secrets location</div>
            <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs break-all">/opt/opencel/secrets/github_app_private_key.pem</div>
            <div className="text-xs text-muted-foreground">
              Configure App ID, webhook secret, and private key in <span className="font-mono">Admin</span>, then click <span className="font-mono">Apply</span>.
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            {ghApp?.configured ? <Badge variant="secondary">App configured</Badge> : <Badge variant="outline">App not configured</Badge>}
            {ghApp?.app_id ? <span className="text-sm text-muted-foreground">App ID: {ghApp.app_id}</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
