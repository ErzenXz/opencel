"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID, setStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";

type Org = {
  id: string;
  slug: string;
  name: string;
  role: string;
  created_at: string;
};
type Member = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">(
    "member"
  );

  const orgID = useMemo(() => getStoredOrgID(), []);
  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === orgID) || null,
    [orgs, orgID]
  );

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
      const o = (await apiFetch("/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName }),
      })) as Org;
      toast.success("Team created");
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
      await apiFetch(`/api/orgs/${orgID}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
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
      await apiFetch(`/api/orgs/${orgID}/members/${userID}`, {
        method: "DELETE",
      });
      toast.success("Member removed");
      refreshMembers();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Teams
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Manage your teams, members, and roles.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#333] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle className="text-white">Create Team</DialogTitle>
              <DialogDescription className="text-[#888]">
                Creates a new team and makes you owner.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Team name"
              className="border-[#333] bg-black text-white placeholder:text-[#555]"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button onClick={createOrg} disabled={!newOrgName}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams List */}
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#666]">
          Your Teams
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-lg border border-[#333] bg-[#0a0a0a]"
              />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-12 text-center">
            <p className="text-sm text-[#888]">No teams yet.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setCreateOpen(true)}
            >
              Create your first team
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-colors",
                  o.id === orgID
                    ? "border-[#555] bg-[#111]"
                    : "border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111]"
                )}
                onClick={() => {
                  setStoredOrgID(o.id);
                  toast.message(`Switched to ${o.name}`);
                  window.location.reload();
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#333] to-[#555] text-sm font-bold uppercase text-white">
                  {o.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {o.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-[#333] text-[10px] text-[#888]"
                    >
                      {o.role}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-[#666]">{o.slug}</div>
                </div>
                {o.id === orgID && (
                  <Check className="h-4 w-4 shrink-0 text-white" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      {activeOrg && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <p className="text-sm text-[#888]">{activeOrg.name}</p>
            </div>
          </div>

          {/* Invite form */}
          <div className="mb-6 rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
            <div className="mb-3 text-sm font-medium text-[#ededed]">
              Invite Member
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="border-[#333] bg-black text-white placeholder:text-[#555]"
              />
              <Select
                value={inviteRole}
                onValueChange={(v) =>
                  setInviteRole(v as "member" | "admin" | "owner")
                }
              >
                <SelectTrigger className="border-[#333] bg-black text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="owner">owner</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={invite}
                disabled={!inviteEmail || !orgID}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            </div>
          </div>

          {/* Members list */}
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-12 text-center">
              <p className="text-sm text-[#888]">No members visible.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#333]">
              <div className="hidden border-b border-[#333] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_100px_100px]">
                <div>Member</div>
                <div>Role</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-[#222]">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between gap-4 px-4 py-3 md:grid md:grid-cols-[1fr_100px_100px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                        {m.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white">
                          {m.email}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="border-[#333] text-xs text-[#888]"
                      >
                        {m.role}
                      </Badge>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => removeMember(m.user_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
