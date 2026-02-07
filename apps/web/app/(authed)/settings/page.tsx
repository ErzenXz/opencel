"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const [gh, setGh] = useState<{ configured: boolean; app_id?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = (await apiFetch("/api/integrations/github/status")) as any;
        setGh(st);
      } catch (e: any) {
        toast.error(String(e?.message || e));
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
          <CardDescription>OpenCel uses a GitHub App for installation tokens and webhook verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {gh?.configured ? <Badge variant="secondary">Configured</Badge> : <Badge variant="outline">Not configured</Badge>}
            {gh?.app_id ? <span className="text-sm text-muted-foreground">App ID: {gh.app_id}</span> : null}
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
            <div className="text-xs text-muted-foreground">Set App ID and webhook secret in <span className="font-mono">/opt/opencel/.env</span>, then restart api/worker.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

