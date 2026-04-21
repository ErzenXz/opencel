"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, Plus, Trash2, Copy, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
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

type Service = {
  id: string;
  location_id?: string;
  node_id?: string;
  name: string;
  kind: "postgres" | "redis" | "mysql" | "mongodb";
  version: string;
  status: "provisioning" | "running" | "stopped" | "failed" | "deleting";
  container_name?: string;
  internal_host?: string;
  internal_port?: number;
  username?: string;
  database_name?: string;
  error_message?: string;
  created_at: string;
};

type Location = { id: string; name: string };

const KIND_LABEL: Record<Service["kind"], string> = {
  postgres: "Postgres",
  redis: "Redis",
  mysql: "MySQL",
  mongodb: "MongoDB",
};

function StatusBadge({ status }: { status: Service["status"] }) {
  if (status === "running") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-900 bg-emerald-950/50 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Running
      </Badge>
    );
  }
  if (status === "provisioning") {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-900 bg-yellow-950/50 text-yellow-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Provisioning
      </Badge>
    );
  }
  if (status === "deleting") {
    return (
      <Badge variant="outline" className="gap-1 border-[#2a2a2a] bg-[#0a0a0a] text-[#888]">
        <Clock className="h-3 w-3" />
        Deleting
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-red-900 bg-red-950/50 text-red-400">
      <XCircle className="h-3 w-3" />
      {status === "failed" ? "Failed" : "Stopped"}
    </Badge>
  );
}

export default function DatabasesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    kind: Service["kind"];
    version: string;
    location_id: string;
  }>({ name: "", kind: "postgres", version: "", location_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedID, setExpandedID] = useState<string | null>(null);
  const [conn, setConn] = useState<Record<string, { uri?: string; password?: string }>>({});
  const orgID = useMemo(() => getStoredOrgID(), []);

  async function refresh() {
    if (!orgID) {
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [svs, ls] = await Promise.all([
        apiFetch(`/api/orgs/${orgID}/services`) as Promise<Service[]>,
        apiFetch(`/api/orgs/${orgID}/locations`) as Promise<Location[]>,
      ]);
      setServices(svs || []);
      setLocations(ls || []);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [orgID]);

  async function create() {
    if (!orgID) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/orgs/${orgID}/services`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", kind: "postgres", version: "", location_id: "" });
      toast.success("Database provisioning started");
      refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this database? Data will be destroyed.")) return;
    try {
      await apiFetch(`/api/services/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  async function loadConn(id: string) {
    try {
      const c = (await apiFetch(`/api/services/${id}/connection`)) as {
        uri?: string;
        password?: string;
      };
      setConn((prev) => ({ ...prev, [id]: c }));
    } catch (e) {
      toast.error(`Failed to load connection: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Databases</h1>
          <p className="mt-1 text-sm text-[#888]">
            Managed Postgres, Redis, MySQL and MongoDB running on your own nodes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Database
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#1f1f1f] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle>Create Database</DialogTitle>
              <DialogDescription className="text-[#888]">
                OpenCel will pick an online node (preferring the selected location) and run the container there.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs text-[#888]">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="app-cache"
                  className="mt-1 border-[#2a2a2a] bg-black"
                />
              </div>
              <div>
                <label className="text-xs text-[#888]">Type</label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v as Service["kind"] }))}
                >
                  <SelectTrigger className="mt-1 border-[#2a2a2a] bg-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">Postgres</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[#888]">Version (optional)</label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="16 / 7 / 8 / 7"
                  className="mt-1 border-[#2a2a2a] bg-black"
                />
              </div>
              <div>
                <label className="text-xs text-[#888]">Location (optional)</label>
                <Select
                  value={form.location_id || "any"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, location_id: v === "any" ? "" : v }))
                  }
                >
                  <SelectTrigger className="mt-1 border-[#2a2a2a] bg-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any available node</SelectItem>
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

      {loading ? (
        <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-8 text-center text-sm text-[#666]">
          Loading…
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a] py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
            <Database className="h-5 w-5 text-[#888]" />
          </div>
          <p className="text-sm text-white">No databases yet</p>
          <p className="mt-1 text-xs text-[#666]">
            Provision a managed Postgres, Redis, MySQL, or MongoDB on one of your nodes.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
          <div className="hidden border-b border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_120px_120px_140px_120px_80px]">
            <div>Database</div>
            <div>Type</div>
            <div>Status</div>
            <div>Host</div>
            <div>Location</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-[#1f1f1f]">
            {services.map((sv) => (
              <div key={sv.id}>
                <div className="grid items-center gap-4 px-4 py-3 md:grid-cols-[1fr_120px_120px_140px_120px_80px]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
                      <Database className="h-4 w-4 text-[#888]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">{sv.name}</div>
                      {sv.error_message && (
                        <div className="truncate text-xs text-red-400" title={sv.error_message}>
                          {sv.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-[#ededed]">
                    {KIND_LABEL[sv.kind]} {sv.version}
                  </div>
                  <div>
                    <StatusBadge status={sv.status} />
                  </div>
                  <div className="truncate text-xs text-[#888]">
                    {sv.internal_host ? `${sv.internal_host}:${sv.internal_port}` : "—"}
                  </div>
                  <div className="text-sm text-[#888]">
                    {locations.find((l) => l.id === sv.location_id)?.name || "—"}
                  </div>
                  <div className="flex justify-end gap-1">
                    {sv.status === "running" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (expandedID === sv.id) {
                            setExpandedID(null);
                          } else {
                            setExpandedID(sv.id);
                            if (!conn[sv.id]) loadConn(sv.id);
                          }
                        }}
                        className="h-8 px-2 text-xs text-[#ededed]"
                      >
                        Connect
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => del(sv.id)}
                      className="h-8 w-8 p-0 text-[#888] hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {expandedID === sv.id && conn[sv.id]?.uri && (
                  <div className="border-t border-[#1f1f1f] bg-[#080808] px-4 py-3">
                    <div className="mb-2 text-xs text-[#888]">Connection URI</div>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto rounded-md border border-[#1f1f1f] bg-black p-2 text-xs text-[#ededed]">
                        {conn[sv.id].uri}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1 border-[#2a2a2a] bg-transparent"
                        onClick={() => {
                          navigator.clipboard.writeText(conn[sv.id].uri || "");
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
