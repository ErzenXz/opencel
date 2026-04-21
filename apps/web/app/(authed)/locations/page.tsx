"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Trash2, Server } from "lucide-react";
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

type Location = {
  id: string;
  slug: string;
  name: string;
  region?: string;
  country?: string;
  node_count: number;
  created_at: string;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", region: "", country: "" });
  const [submitting, setSubmitting] = useState(false);
  const orgID = useMemo(() => getStoredOrgID(), []);

  async function refresh() {
    if (!orgID) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rs = (await apiFetch(`/api/orgs/${orgID}/locations`)) as Location[];
      setLocations(rs || []);
    } catch (e) {
      toast.error(`Failed to load locations: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [orgID]);

  async function create() {
    if (!orgID) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/orgs/${orgID}/locations`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", slug: "", region: "", country: "" });
      toast.success("Location created");
      refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this location? Nodes assigned to it will be unassigned.")) return;
    try {
      await apiFetch(`/api/locations/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Locations</h1>
          <p className="mt-1 text-sm text-[#888]">
            Geographic regions where your workloads run. Add nodes to a location to distribute deployments and managed services.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Location
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#1f1f1f] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle>Create Location</DialogTitle>
              <DialogDescription className="text-[#888]">
                A location is a logical region. You&apos;ll add nodes (VMs) to it next.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs text-[#888]">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Europe"
                  className="mt-1 border-[#2a2a2a] bg-black"
                />
              </div>
              <div>
                <label className="text-xs text-[#888]">Slug (optional)</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="europe"
                  className="mt-1 border-[#2a2a2a] bg-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#888]">Region code</label>
                  <Input
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    placeholder="eu-west"
                    className="mt-1 border-[#2a2a2a] bg-black"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888]">Country</label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="DE"
                    className="mt-1 border-[#2a2a2a] bg-black"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-[#2a2a2a] bg-transparent"
                onClick={() => setOpen(false)}
              >
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
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a] py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
            <MapPin className="h-5 w-5 text-[#888]" />
          </div>
          <p className="text-sm text-white">No locations yet</p>
          <p className="mt-1 text-xs text-[#666]">
            Create your first location to start organizing your infrastructure.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
          <div className="hidden border-b border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_120px_120px_120px_40px]">
            <div>Location</div>
            <div>Region</div>
            <div>Country</div>
            <div>Nodes</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-[#1f1f1f]">
            {locations.map((l) => (
              <div
                key={l.id}
                className="grid items-center gap-4 px-4 py-3 md:grid-cols-[1fr_120px_120px_120px_40px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#111]">
                    <MapPin className="h-4 w-4 text-[#888]" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{l.name}</div>
                    <div className="truncate text-xs text-[#666]">{l.slug}</div>
                  </div>
                </div>
                <div className="text-sm text-[#888]">{l.region || "—"}</div>
                <div className="text-sm text-[#888]">{l.country || "—"}</div>
                <div>
                  <Badge variant="outline" className="gap-1 border-[#2a2a2a] text-[#ededed]">
                    <Server className="h-3 w-3" />
                    {l.node_count}
                  </Badge>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del(l.id)}
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
