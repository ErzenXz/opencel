"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID, setStoredOrgID } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Org = { id: string; name: string; slug: string; role: string };
type Repo = { id: number; full_name: string; private: boolean; default_branch: string; updated_at: string; html_url: string };

export default function ImportPage() {
  const router = useRouter();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgID, setOrgID] = useState("");

  const [ghMe, setGhMe] = useState<{ connected: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [repoFullName, setRepoFullName] = useState("");
  const [slug, setSlug] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [buildPreset, setBuildPreset] = useState("");

  const canImport = useMemo(() => !!orgID && !!repoFullName && !!slug, [orgID, repoFullName, slug]);

  useEffect(() => {
    (async () => {
      try {
        const os = (await apiFetch("/api/orgs")) as Org[];
        setOrgs(os);
        const stored = getStoredOrgID();
        const pick = os.find((o) => o.id === stored)?.id || os[0]?.id || "";
        setOrgID(pick);
        if (pick) setStoredOrgID(pick);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
      try {
        const me = (await apiFetch("/api/github/me")) as any;
        setGhMe(me);
      } catch {
        setGhMe({ connected: false });
      }
    })();
  }, []);

  async function loadRepos(q: string) {
    setLoadingRepos(true);
    try {
      const res = (await apiFetch(`/api/github/repos?query=${encodeURIComponent(q)}&page=1&per_page=30`)) as any;
      setRepos(res.repos || []);
    } catch (e: any) {
      toast.error(String(e?.message || e));
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    if (!ghMe?.connected) return;
    loadRepos(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghMe?.connected]);

  async function onSelectRepo(r: Repo) {
    setRepoFullName(r.full_name);
    const repoName = r.full_name.split("/")[1] || r.full_name;
    const s = repoName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    setSlug(s.slice(0, 32) || "my-app");
  }

  async function importProject() {
    if (!canImport) return;
    try {
      const res = (await apiFetch(`/api/orgs/${orgID}/projects/import`, {
        method: "POST",
        body: JSON.stringify({
          repo_full_name: repoFullName,
          slug,
          root_dir: rootDir,
          build_preset: buildPreset
        })
      })) as any;
      const p = res.project;
      toast.success("Project imported");
      router.replace(`/projects/${p.id}`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Project</h1>
        <p className="text-sm text-muted-foreground">Connect GitHub, pick a repo, and create a project.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Organization</CardTitle>
          <CardDescription>Projects belong to an organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={orgID}
            onValueChange={(v) => {
              setOrgID(v);
              setStoredOrgID(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an org" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. GitHub</CardTitle>
          <CardDescription>Connect your GitHub account to browse repos. You can also paste owner/repo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghMe?.connected ? (
            <div className="text-sm text-muted-foreground">GitHub connected.</div>
          ) : (
            <Button asChild>
              <a href="/api/auth/github/start?return_to=/import">Connect GitHub</a>
            </Button>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Repo (owner/repo)</div>
            <Input value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} placeholder="owner/repo" />
          </div>

          {ghMe?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repos..." />
                <Button variant="outline" onClick={() => loadRepos(query)} disabled={loadingRepos}>
                  {loadingRepos ? "Loading..." : "Search"}
                </Button>
              </div>

              {repos.length ? (
                <div className="divide-y divide-border rounded-lg border">
                  {repos.slice(0, 12).map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left p-3 hover:bg-accent transition-colors"
                      onClick={() => onSelectRepo(r)}
                      type="button"
                    >
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.private ? "private" : "public"} · default: {r.default_branch} · {new Date(r.updated_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{loadingRepos ? "Loading..." : "No repos."}</div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Project</CardTitle>
          <CardDescription>Configure project basics. (Advanced settings coming soon.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Slug</div>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-app" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Root directory (optional)</div>
              <Input value={rootDir} onChange={(e) => setRootDir(e.target.value)} placeholder="." />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Build preset (optional)</div>
            <Input value={buildPreset} onChange={(e) => setBuildPreset(e.target.value)} placeholder="auto" />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={importProject} disabled={!canImport}>
              Import
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin">Configure GitHub App</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

