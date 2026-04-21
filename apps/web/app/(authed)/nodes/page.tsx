"use client";

import { useEffect, useMemo, useState } from "react";
import { Server, Plus, Trash2, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Node = {
  id: string;
  location_id?: string;
  name: string;
  role: string;
  status: "pending" | "online" | "offline";
  agent_url?: string;
  hostname?: string;
  agent_version?: string;
  cpu_cores?: number;
  memory_bytes?: number;
  token_prefix?: string;
  last_seen_at?: string;
  created_at: string;
};

type Location = { id: string; name: string; slug: string };

function timeAgo(dateStr?: string) {
  if (!dateStr) return "never";
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatBytes(n?: number) {
  if (!n) return "—";
  const gb = n / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{
    token: string;
    name: string;
  } | null>(null);
  const orgID = useMemo(() => getStoredOrgID(), []);

  async function refresh({ silent = false }: { silent?: boolean } = {}) {
    if (!orgID) {
      setNodes([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [ns, ls] = await Promise.all([
        apiFetch(`/api/orgs/${orgID}/nodes`) as Promise<Node[]>,
        apiFetch(`/api/orgs/${orgID}/locations`) as Promise<Location[]>,
      ]);
      setNodes(ns || []);
      setLocations(ls || []);
    } catch (e) {
      if (!silent) toast.error(`Failed to load nodes: ${(e as Error).message}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(() => refresh({ silent: true }), 15000);
    return () => clearInterval(t);
  }, [orgID]);

  async function create() {
    if (!orgID) return;
    setSubmitting(true);
    try {
      const res = (await apiFetch(`/api/orgs/${orgID}/nodes`, {
        method: "POST",
        body: JSON.stringify(form),
      })) as { node: Node; token: string };
      setIssuedToken({ token: res.token, name: res.node.name });
      setOpen(false);
      setForm({ name: "", location_id: "" });
      refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this node?")) return;
    try {
      await apiFetch(`/api/nodes/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  function StatusBadge({ status }: { status: Node["status"] }) {
    if (status === "online") {
      return (
        <Badge variant="outline" className="gap-1 border-emerald-900 bg-emerald-950/50 text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Online
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-900 bg-yellow-950/50 text-yellow-400">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-red-900 bg-red-950/50 text-red-400">
        <XCircle className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Nodes</h1>
          <p className="mt-1 text-sm text-[#888]">
            Servers that run your deployments and managed services. Add a node here, then run{" "}
            <code className="rounded bg-[#111] px-1 py-0.5 text-xs text-[#ededed]">opencel join</code>{" "}
            on the VM to register it.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Node
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#1f1f1f] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle>Add Node</DialogTitle>
              <DialogDescription className="text-[#888]">
                A registration token will be generated. Run{" "}
                <code className="rounded bg-[#111] px-1 py-0.5 text-xs">opencel join</code>{" "}
                on the target VM with that token.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs text-[#888]">Node name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="europe-worker-1"
                  className="mt-1 border-[#2a2a2a] bg-black"
                />
              </div>
              <div>
                <label className="text-xs text-[#888]">Location</label>
                <Select
                  value={form.location_id || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, location_id: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger className="mt-1 border-[#2a2a2a] bg-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-[#2a2a2a] bg-transparent" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={!form.name || submitting}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {issuedToken && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                Registration token for <span className="text-[#888]">{issuedToken.name}</span>
              </div>
              <p className="mt-1 text-xs text-[#888]">
                Copy this now — it will not be shown again. On the secondary VM, run:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md border border-[#1f1f1f] bg-black p-3 text-xs text-[#ededed]">
{`opencel join --server ${typeof window !== "undefined" ? window.location.origin : "https://your-primary"} \\
  --token ${issuedToken.token}
# Then start the agent (systemd unit is also fine):
opencel agent`}
              </pre>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-[#2a2a2a] bg-transparent"
              onClick={() => {
                navigator.clipboard.writeText(issuedToken.token);
                toast.success("Token copied");
              }}
            >
              <Copy className="h-3 w-3" />
              Copy token
            </Button>
          </div>
          <button
            className="mt-3 text-xs text-[#666] underline hover:text-[#ededed]"
            onClick={() => setIssuedToken(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-8 text-center text-sm text-[#666]">
          Loading…
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a] py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
            <Server className="h-5 w-5 text-[#888]" />
          </div>
          <p className="text-sm text-white">No nodes yet</p>
          <p className="mt-1 text-xs text-[#666]">
            Add a node to expand capacity across VMs.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
          <div className="hidden border-b border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_160px_120px_100px_120px_40px]">
            <div>Node</div>
            <div>Location</div>
            <div>Status</div>
            <div>Resources</div>
            <div>Last seen</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-[#1f1f1f]">
            {nodes.map((n) => (
              <div
                key={n.id}
                className="grid items-center gap-4 px-4 py-3 md:grid-cols-[1fr_160px_120px_100px_120px_40px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
                    <Server className="h-4 w-4 text-[#888]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-white">{n.name}</span>
                      {n.role === "primary" && (
                        <Badge variant="outline" className="border-[#2a2a2a] text-[10px] text-[#ededed]">
                          primary
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-[#666]">
                      {n.hostname || n.agent_url || "—"}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[#888]">
                  {locations.find((l) => l.id === n.location_id)?.name || "Unassigned"}
                </div>
                <div>
                  <StatusBadge status={n.status} />
                </div>
                <div className="text-xs text-[#888]">
                  {n.cpu_cores || 0} cores · {formatBytes(n.memory_bytes)}
                </div>
                <div className="text-xs text-[#888]">{timeAgo(n.last_seen_at)}</div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del(n.id)}
                    className="h-8 w-8 p-0 text-[#888] hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
