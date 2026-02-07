"use client";

import { useEffect, useMemo, useState } from "react";
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
      if (!getStoredOrgID() && os[0]?.id) {
        setStoredOrgID(os[0].id);
      }
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
    } catch (e: any) {
      // Often forbidden for non-admins.
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">Manage orgs and memberships.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Create org</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>Creates a new organization and makes you an owner.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="text-sm font-medium">Name</div>
              <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Acme" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createOrg} disabled={!newOrgName}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your organizations</CardTitle>
          <CardDescription>Role applies per-organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : orgs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No orgs.</div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  className={[
                    "w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors",
                    o.id === orgID ? "bg-accent/30" : ""
                  ].join(" ")}
                  onClick={() => {
                    setStoredOrgID(o.id);
                    toast.message(`Selected org: ${o.name}`);
                    // Reload for pages relying on localStorage.
                    window.location.reload();
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{o.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={o.role === "owner" || o.role === "admin" ? "secondary" : "outline"}>{o.role}</Badge>
                    <div className="text-xs text-muted-foreground hidden sm:block">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {activeOrg ? (
              <span>
                Org: <span className="font-medium">{activeOrg.name}</span>
              </span>
            ) : (
              "Select an org."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-2">
              <div className="text-sm font-medium">Invite by email</div>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Role</div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={invite} disabled={!inviteEmail || !orgID}>
              Add member
            </Button>
            <Button variant="outline" onClick={refreshMembers} disabled={!orgID}>
              Refresh
            </Button>
          </div>

          <Separator />

          {members.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {activeOrg?.role === "member"
                ? "You are a member. Admins/owners can view and manage members."
                : "No members listed (or you don't have permission)."}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {members.map((m) => (
                <div key={m.user_id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.email}</div>
                    <div className="text-xs text-muted-foreground">{m.user_id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{m.role}</Badge>
                    <Button size="sm" variant="destructive" onClick={() => removeMember(m.user_id)}>
                      Remove
                    </Button>
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

