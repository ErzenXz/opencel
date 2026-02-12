"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, PlusCircle, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID, setStoredOrgID } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Org = { id: string; slug: string; name: string; role: string; created_at: string };
type Member = { user_id: string; email: string; role: string; created_at: string };

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">("member");

  const orgID = useMemo(() => getStoredOrgID(), []);
  const activeOrg = useMemo(() => orgs.find((o) => o.id === orgID) || null, [orgs, orgID]);

  async function refreshOrgs() {
    setLoading(true);
    try {
      const os = (await apiFetch("/api/orgs")) as Org[];
      setOrgs(os);
      if (!getStoredOrgID() && os[0]?.id) setStoredOrgID(os[0].id);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshMembers() {
    if (!orgID) return;
    try {
      const ms = (await apiFetch(`/api/orgs/${orgID}/members`)) as Member[];
      setMembers(ms);
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    refreshOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgID]);

  async function createOrg() {
    try {
      const o = (await apiFetch("/api/orgs", { method: "POST", body: JSON.stringify({ name: newOrgName }) })) as Org;
      toast.success("Organization created");
      setCreateOpen(false);
      setNewOrgName("");
      setOrgs((prev) => [...prev, o]);
      setStoredOrgID(o.id);
      await refreshOrgs();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  async function invite() {
    if (!orgID) return;
    try {
      await apiFetch(`/api/orgs/${orgID}/members`, { method: "POST", body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      toast.success("Member added");
      setInviteEmail("");
      setInviteRole("member");
      refreshMembers();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  async function removeMember(userID: string) {
    if (!orgID) return;
    try {
      await apiFetch(`/api/orgs/${orgID}/members/${userID}`, { method: "DELETE" });
      toast.success("Member removed");
      refreshMembers();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Team Management</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Organizations</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage org workspaces, roles, and invites.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><PlusCircle className="h-4 w-4" />Create org</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>Creates a new organization and makes you owner.</DialogDescription>
            </DialogHeader>
            <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Acme" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createOrg} disabled={!newOrgName}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Organizations</div><div className="mt-2 text-xl font-semibold">{orgs.length}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Active workspace</div><div className="mt-2 text-sm font-medium truncate">{activeOrg?.name || "None"}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Members listed</div><div className="mt-2 text-xl font-semibold">{members.length}</div></CardContent></Card>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Your organizations</CardTitle>
          <CardDescription>Select a workspace to scope projects and members.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-zinc-500">Loading organizations...</div>
          ) : orgs.length === 0 ? (
            <div className="text-sm text-zinc-500">No organizations yet.</div>
          ) : (
            <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  className={["w-full px-4 py-3 text-left transition hover:bg-white/[0.03]", o.id === orgID ? "bg-white/[0.06]" : ""].join(" ")}
                  onClick={() => {
                    setStoredOrgID(o.id);
                    toast.message(`Selected ${o.name}`);
                    window.location.reload();
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">{o.name}</div>
                      <div className="truncate text-xs text-zinc-500">{o.slug}</div>
                    </div>
                    <Badge variant={o.role === "owner" || o.role === "admin" ? "secondary" : "outline"}>{o.role}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Members</CardTitle>
          <CardDescription>{activeOrg ? `Org: ${activeOrg.name}` : "Select an organization first."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Invite email</div>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" className="border-white/10 bg-white/[0.02]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Role</div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "member" | "admin" | "owner")}>
                <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={invite} disabled={!inviteEmail || !orgID} className="gap-2"><UserPlus className="h-4 w-4" />Add member</Button>
            <Button variant="outline" onClick={refreshMembers} disabled={!orgID} className="border-white/15 bg-transparent hover:bg-white/5">Refresh</Button>
          </div>

          <Separator className="bg-white/10" />

          {members.length === 0 ? (
            <div className="text-sm text-zinc-500">No members visible for this org.</div>
          ) : (
            <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">{m.email}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-500">{m.user_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    <Button size="sm" variant="destructive" onClick={() => removeMember(m.user_id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
