"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, GitBranch, Globe2, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
      toast.success("Settings saved");
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
      const res = (await apiFetch("/api/admin/apply", { method: "POST", body: "{}" })) as { job_id: string };
      setJobID(res.job_id);
      toast.success("Apply job queued");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setApplying(false);
    }
  }

  async function loadJob() {
    if (!jobID) return;
    try {
      const j = (await apiFetch(`/api/admin/jobs/${jobID}`)) as AdminJob;
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
    return <div className="text-sm text-zinc-500">Loading admin controls...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Instance Control
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Admin</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">Configure domains, GitHub credentials, and agent apply jobs. This panel mirrors Vercel-style environment controls with self-hosted ownership.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">Base domain</div>
            <div className="mt-2 truncate text-sm font-medium">{baseDomain || "not set"}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">TLS mode</div>
            <div className="mt-2 text-sm font-medium capitalize">{tlsMode}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">GitHub App</div>
            <div className="mt-2">{st?.github_app_id_configured ? <Badge variant="secondary">Configured</Badge> : <Badge variant="outline">Missing</Badge>}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/20">
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">Auto updates</div>
            <div className="mt-2 text-sm font-medium">{autoUpdatesEnabled ? `Enabled (${autoUpdatesInterval})` : "Disabled"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" />Domain and TLS</CardTitle>
            <CardDescription>Routing and certificate behavior for the main control-plane domain.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Base domain</div>
              <Input value={baseDomain} onChange={(e) => setBaseDomain(e.target.value)} placeholder="opencel.example.com" className="border-white/10 bg-white/[0.02]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Public scheme</div>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">https</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">TLS mode</div>
              <Select value={tlsMode} onValueChange={setTlsMode}>
                <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="letsencrypt">letsencrypt</SelectItem>
                  <SelectItem value="cloudflared">cloudflared</SelectItem>
                  <SelectItem value="disabled">disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4" />Update policy</CardTitle>
            <CardDescription>Set interval used by background self-update jobs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Enabled</div>
                <Select value={autoUpdatesEnabled ? "yes" : "no"} onValueChange={(v) => setAutoUpdatesEnabled(v === "yes")}>
                  <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">enabled</SelectItem>
                    <SelectItem value="no">disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Interval</div>
                <Select value={autoUpdatesInterval} onValueChange={setAutoUpdatesInterval}>
                  <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">hourly</SelectItem>
                    <SelectItem value="daily">daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />GitHub OAuth + App</CardTitle>
          <CardDescription>OAuth is used for repo browsing. App credentials are used for deploy hooks and installation tokens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">OAuth Client ID</div>
              <Input value={oauthClientID} onChange={(e) => setOauthClientID(e.target.value)} placeholder="Iv1..." className="border-white/10 bg-white/[0.02]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">OAuth Client Secret</div>
              <Input
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                placeholder={st?.github_oauth_client_secret_configured ? "(configured)" : "(not configured)"}
                className="border-white/10 bg-white/[0.02]"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">GitHub App ID</div>
              <Input value={ghAppID} onChange={(e) => setGhAppID(e.target.value)} placeholder="123456" className="border-white/10 bg-white/[0.02]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Webhook Secret</div>
              <Input
                value={ghWebhookSecret}
                onChange={(e) => setGhWebhookSecret(e.target.value)}
                placeholder={st?.github_app_webhook_secret_configured ? "(configured)" : "(not configured)"}
                className="border-white/10 bg-white/[0.02]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Private Key PEM</div>
            <Textarea
              value={ghPrivateKey}
              onChange={(e) => setGhPrivateKey(e.target.value)}
              placeholder={st?.github_app_private_key_configured ? "(configured, paste to replace)" : "-----BEGIN PRIVATE KEY-----"}
              className="min-h-[140px] border-white/10 bg-white/[0.02] font-mono text-xs"
            />
          </div>

          <Separator className="bg-white/10" />

          <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
            <div className="mb-1 text-zinc-200">Webhook URL</div>
            <div className="font-mono break-all">{webhookURL}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" />Apply changes</CardTitle>
          <CardDescription>Persist settings and run a server-side apply job handled by opencel-agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <Button onClick={apply} disabled={applying} variant="secondary">
              {applying ? "Queueing..." : "Apply"}
            </Button>
            <Button variant="outline" onClick={refresh} className="border-white/15 bg-transparent hover:bg-white/5">
              Refresh
            </Button>
          </div>

          {jobID ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400">Job:</span>
                <span className="font-mono text-xs">{jobID}</span>
                {job?.status ? (
                  <Badge variant={job.status === "SUCCEEDED" ? "secondary" : "outline"}>
                    {job.status === "SUCCEEDED" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                    {job.status}
                  </Badge>
                ) : null}
              </div>
              <pre className="min-h-[240px] whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-5 text-zinc-300">
                {jobLogs.length ? jobLogs.map((l) => l.chunk).join("") : "(waiting for logs...)"}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">No apply job queued.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
