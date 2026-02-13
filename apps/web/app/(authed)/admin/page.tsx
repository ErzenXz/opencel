"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        ok
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-yellow-500/10 text-yellow-400"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-emerald-400" : "bg-yellow-400"
        )}
      />
      {label}
    </span>
  );
}

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
    const base =
      typeof window !== "undefined"
        ? window.location.host
        : "<base-domain>";
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
          ...(oauthClientSecret
            ? { github_oauth_client_secret: oauthClientSecret }
            : {}),
          github_app_id: ghAppID,
          ...(ghWebhookSecret
            ? { github_app_webhook_secret: ghWebhookSecret }
            : {}),
          ...(ghPrivateKey
            ? { github_app_private_key_pem: ghPrivateKey }
            : {}),
          auto_updates_enabled: autoUpdatesEnabled,
          auto_updates_interval: autoUpdatesInterval,
        }),
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
      const res = (await apiFetch("/api/admin/apply", {
        method: "POST",
        body: "{}",
      })) as { job_id: string };
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
      const j = (await apiFetch(
        `/api/admin/jobs/${jobID}`
      )) as AdminJob;
      setJob(j);
      const ls = (await apiFetch(
        `/api/admin/jobs/${jobID}/logs`
      )) as JobLog[];
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
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#888]">
        Loading admin settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Admin
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Instance configuration, credentials, and apply jobs.
        </p>
      </div>

      {/* Status overview */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-4">
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Base Domain</div>
          <div className="mt-1 truncate text-sm text-white">
            {baseDomain || "—"}
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">TLS</div>
          <div className="mt-1 text-sm capitalize text-white">{tlsMode}</div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">GitHub App</div>
          <div className="mt-1">
            <StatusBadge
              ok={!!st?.github_app_id_configured}
              label={st?.github_app_id_configured ? "Configured" : "Missing"}
            />
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Auto Updates</div>
          <div className="mt-1 text-sm text-white">
            {autoUpdatesEnabled
              ? `Enabled · ${autoUpdatesInterval}`
              : "Disabled"}
          </div>
        </div>
      </div>

      {/* Domain & TLS */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">Domain & TLS</h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Routing and certificate configuration for the control plane.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label className="text-sm text-[#888]">Base Domain</label>
            <Input
              value={baseDomain}
              onChange={(e) => setBaseDomain(e.target.value)}
              placeholder="opencel.example.com"
              className="border-[#333] bg-black text-white placeholder:text-[#555]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Scheme</label>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger className="border-[#333] bg-black text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">https</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">TLS Mode</label>
              <Select value={tlsMode} onValueChange={setTlsMode}>
                <SelectTrigger className="border-[#333] bg-black text-white">
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
        </div>
      </section>

      {/* Update Policy */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">Update Policy</h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Self-update interval for the agent.
          </p>
        </div>
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-[#888]">Auto Updates</label>
            <Select
              value={autoUpdatesEnabled ? "yes" : "no"}
              onValueChange={(v) => setAutoUpdatesEnabled(v === "yes")}
            >
              <SelectTrigger className="border-[#333] bg-black text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Enabled</SelectItem>
                <SelectItem value="no">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[#888]">Interval</label>
            <Select
              value={autoUpdatesInterval}
              onValueChange={setAutoUpdatesInterval}
            >
              <SelectTrigger className="border-[#333] bg-black text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* GitHub OAuth & App */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            GitHub OAuth & App
          </h2>
          <p className="mt-0.5 text-xs text-[#666]">
            OAuth for repo browsing. App credentials for deploy hooks and
            installation tokens.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#888]">OAuth Client ID</label>
              <Input
                value={oauthClientID}
                onChange={(e) => setOauthClientID(e.target.value)}
                placeholder="Iv1..."
                className="border-[#333] bg-black text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">
                OAuth Client Secret
              </label>
              <Input
                type="password"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                placeholder={
                  st?.github_oauth_client_secret_configured
                    ? "••••••••"
                    : "Not configured"
                }
                className="border-[#333] bg-black text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">GitHub App ID</label>
              <Input
                value={ghAppID}
                onChange={(e) => setGhAppID(e.target.value)}
                placeholder="123456"
                className="border-[#333] bg-black text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Webhook Secret</label>
              <Input
                type="password"
                value={ghWebhookSecret}
                onChange={(e) => setGhWebhookSecret(e.target.value)}
                placeholder={
                  st?.github_app_webhook_secret_configured
                    ? "••••••••"
                    : "Not configured"
                }
                className="border-[#333] bg-black text-white placeholder:text-[#555]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[#888]">Private Key PEM</label>
            <Textarea
              value={ghPrivateKey}
              onChange={(e) => setGhPrivateKey(e.target.value)}
              placeholder={
                st?.github_app_private_key_configured
                  ? "(configured — paste to replace)"
                  : "-----BEGIN RSA PRIVATE KEY-----"
              }
              className="min-h-[120px] border-[#333] bg-black font-mono text-xs text-white placeholder:text-[#555]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#333] px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <span className="text-[#666]">Webhook URL:</span>
            <code className="rounded bg-[#111] px-1.5 py-0.5 font-mono text-[#ededed]">
              {webhookURL}
            </code>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-[#888] hover:text-white"
            onClick={() => {
              navigator.clipboard.writeText(webhookURL);
              toast.success("Copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </section>

      {/* Actions + apply job */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">Apply Changes</h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Save settings and run a server-side apply job via opencel-agent.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button
              onClick={apply}
              disabled={applying}
              variant="outline"
              className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
            >
              {applying ? "Queueing..." : "Apply"}
            </Button>
            <Button
              variant="ghost"
              onClick={refresh}
              className="text-[#888] hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {jobID ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[#888]">Job</span>
                <code className="rounded bg-[#111] px-1.5 py-0.5 font-mono text-xs text-[#ededed]">
                  {jobID.slice(0, 12)}
                </code>
                {job?.status && (
                  <StatusBadge
                    ok={job.status === "SUCCEEDED"}
                    label={job.status}
                  />
                )}
              </div>
              <pre className="max-h-[320px] min-h-[200px] overflow-auto rounded-lg border border-[#333] bg-black p-4 font-mono text-xs leading-5 text-[#ededed]">
                {jobLogs.length
                  ? jobLogs.map((l) => l.chunk).join("")
                  : "(waiting for logs...)"}
              </pre>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#666]">
              No apply job running. Save settings first, then apply.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
