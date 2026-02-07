"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdminSettings = {
  base_domain: string;
  public_scheme: string;
  tls_mode: string;

  github_oauth_client_id_configured: boolean;
  github_oauth_client_id?: string;
  github_oauth_client_secret_configured: boolean;

  github_app_id_configured: boolean;
  github_app_id?: string;
  github_app_webhook_secret_configured: boolean;
  github_app_private_key_configured: boolean;

  auto_updates_enabled: boolean;
  auto_updates_interval: string;
};

type AdminJob = {
  id: string;
  type: string;
  status: string;
  error?: string | null;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
};

type JobLog = { id: number; ts: string; stream: string; chunk: string };

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [st, setSt] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // Write-only fields.
  const [oauthClientID, setOauthClientID] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [ghAppID, setGhAppID] = useState("");
  const [ghWebhookSecret, setGhWebhookSecret] = useState("");
  const [ghPrivateKey, setGhPrivateKey] = useState("");

  const [baseDomain, setBaseDomain] = useState("");
  const [scheme, setScheme] = useState("https");
  const [tlsMode, setTlsMode] = useState("letsencrypt");
  const [autoUpdatesEnabled, setAutoUpdatesEnabled] = useState(true);
  const [autoUpdatesInterval, setAutoUpdatesInterval] = useState("hourly");

  const [jobID, setJobID] = useState("");
  const [job, setJob] = useState<AdminJob | null>(null);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);

  const webhookURL = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.host : "<base-domain>";
    return `https://${base}/api/webhooks/github`;
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const s = (await apiFetch("/api/admin/settings")) as AdminSettings;
      setSt(s);
      setOauthClientID(s.github_oauth_client_id || "");
      setBaseDomain(s.base_domain || "");
      setScheme(s.public_scheme || "https");
      setTlsMode(s.tls_mode || "letsencrypt");
      setAutoUpdatesEnabled(!!s.auto_updates_enabled);
      setAutoUpdatesInterval(s.auto_updates_interval || "hourly");
      setGhAppID(s.github_app_id || "");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          base_domain: baseDomain,
          public_scheme: scheme,
          tls_mode: tlsMode,
          github_oauth_client_id: oauthClientID,
          ...(oauthClientSecret ? { github_oauth_client_secret: oauthClientSecret } : {}),
          github_app_id: ghAppID,
          ...(ghWebhookSecret ? { github_app_webhook_secret: ghWebhookSecret } : {}),
          ...(ghPrivateKey ? { github_app_private_key_pem: ghPrivateKey } : {}),
          auto_updates_enabled: autoUpdatesEnabled,
          auto_updates_interval: autoUpdatesInterval
        })
      });
      setOauthClientSecret("");
      setGhWebhookSecret("");
      setGhPrivateKey("");
      toast.success("Saved");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function apply() {
    setApplying(true);
    try {
      const res = (await apiFetch("/api/admin/apply", { method: "POST", body: "{}" })) as any;
      setJobID(res.job_id);
      toast.success("Apply queued");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setApplying(false);
    }
  }

  async function loadJob() {
    if (!jobID) return;
    try {
      const j = (await apiFetch(`/api/admin/jobs/${jobID}`)) as any;
      setJob(j);
      const ls = (await apiFetch(`/api/admin/jobs/${jobID}/logs`)) as JobLog[];
      setJobLogs(ls);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!jobID) return;
    loadJob();
    const t = setInterval(loadJob, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobID]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instance Admin</h1>
        <p className="text-sm text-muted-foreground">Configure domains, integrations, and apply changes safely.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Domain and TLS</CardTitle>
          <CardDescription>These settings are applied by the agent when you click Apply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Base domain</div>
              <Input value={baseDomain} onChange={(e) => setBaseDomain(e.target.value)} placeholder="opencel.example.com" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Public scheme</div>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">https</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">TLS mode</div>
              <Select value={tlsMode} onValueChange={setTlsMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letsencrypt">Let&apos;s Encrypt</SelectItem>
                  <SelectItem value="cloudflared">Cloudflared</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GitHub OAuth</CardTitle>
          <CardDescription>Used for “Connect GitHub” and repo picker in the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Client ID</div>
              <Input value={oauthClientID} onChange={(e) => setOauthClientID(e.target.value)} placeholder="Iv1..." />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Client secret (write-only)</div>
              <Input value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} placeholder={st?.github_oauth_client_secret_configured ? "(configured)" : "(not configured)"} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Redirect URL: <span className="font-mono break-all">{`https://${typeof window !== "undefined" ? window.location.host : "<base>"}/api/auth/github/callback`}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GitHub App</CardTitle>
          <CardDescription>Used for webhooks and deployment installation tokens (deploy-on-push).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">App ID</div>
              <Input value={ghAppID} onChange={(e) => setGhAppID(e.target.value)} placeholder="123456" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Webhook secret (write-only)</div>
              <Input
                value={ghWebhookSecret}
                onChange={(e) => setGhWebhookSecret(e.target.value)}
                placeholder={st?.github_app_webhook_secret_configured ? "(configured)" : "(not configured)"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Private key PEM (write-only)</div>
            <Textarea
              value={ghPrivateKey}
              onChange={(e) => setGhPrivateKey(e.target.value)}
              placeholder={st?.github_app_private_key_configured ? "(configured, paste to replace)" : "-----BEGIN RSA PRIVATE KEY-----\n..."}
              className="font-mono text-xs"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Webhook URL</div>
            <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs break-all">{webhookURL}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apply</CardTitle>
          <CardDescription>Queues an apply job handled by the opencel-agent service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <Button onClick={apply} disabled={applying} variant="secondary">
              {applying ? "Queueing..." : "Apply"}
            </Button>
            <Button onClick={refresh} variant="outline">
              Refresh
            </Button>
          </div>

          {jobID ? (
            <div className="space-y-2">
              <div className="text-sm">
                Job: <span className="font-mono">{jobID}</span>{" "}
                {job?.status ? <span className="text-muted-foreground">({job.status})</span> : null}
              </div>
              <pre className="min-h-[220px] whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 text-xs leading-5">
                {jobLogs.length ? jobLogs.map((l) => l.chunk).join("") : "(waiting for logs...)"}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No apply job queued yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
