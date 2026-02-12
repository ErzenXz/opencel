"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID, setStoredOrgID } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PROJECT_TEMPLATES, getProjectTemplate, type ProjectTemplate } from "@/lib/project-templates";

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
  const [templateID, setTemplateID] = useState<ProjectTemplate["id"]>("web-service");

  const canImport = useMemo(() => !!orgID && !!repoFullName && !!slug, [orgID, repoFullName, slug]);
  const selectedTemplate = getProjectTemplate(templateID);

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
        const me = (await apiFetch("/api/github/me")) as { connected: boolean };
        setGhMe(me);
      } catch {
        setGhMe({ connected: false });
      }
    })();
  }, []);

  async function loadRepos(q: string) {
    setLoadingRepos(true);
    try {
      const res = (await apiFetch(`/api/github/repos?query=${encodeURIComponent(q)}&page=1&per_page=30`)) as { repos?: Repo[] };
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
    const s = repoName.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-").replaceAll(/(^-+)|(-+$)/g, "");
    setSlug(s.slice(0, 32) || "my-app");
  }

  function applyTemplate(id: ProjectTemplate["id"]) {
    const t = getProjectTemplate(id);
    setTemplateID(id);
    if (!repoFullName || repoFullName.includes("owner/")) setRepoFullName(t.suggestedRepo);
    if (!buildPreset) setBuildPreset(t.suggestedBuildPreset);
    if (!rootDir) setRootDir(t.suggestedRootDir);
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
      })) as { project: { id: string } };
      toast.success("Project imported");
      router.replace(`/projects/${res.project.id}`);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500"><Sparkles className="h-3.5 w-3.5" />Guided Import</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Import from GitHub</h1>
        <p className="mt-1 text-sm text-zinc-400">Select template defaults, choose repo, and create a project in one flow.</p>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="text-base">1. Select template</CardTitle>
          <CardDescription>Presets optimize root/build defaults for each project style.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROJECT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const active = templateID === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className={[
                  "rounded-lg border p-4 text-left transition",
                  active ? "border-white/30 bg-white/[0.08]" : "border-white/10 bg-black/30 hover:bg-white/[0.03]"
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-zinc-300" />
                  <Badge variant={active ? "secondary" : "outline"}>{template.label}</Badge>
                </div>
                <p className="mt-3 text-xs text-zinc-500">{template.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Github className="h-4 w-4" />2. Repository</CardTitle>
            <CardDescription>Connect GitHub and choose an organization repository.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={orgID} onValueChange={(v) => { setOrgID(v); setStoredOrgID(v); }}>
              <SelectTrigger className="border-white/10 bg-white/[0.02]"><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name} ({o.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!ghMe?.connected ? (
              <Button asChild><a href="/api/auth/github/start?return_to=/import">Connect GitHub</a></Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repos..." className="border-white/10 bg-white/[0.02] pl-9" />
                  </div>
                  <Button variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={() => loadRepos(query)} disabled={loadingRepos}>
                    {loadingRepos ? "Loading..." : "Search"}
                  </Button>
                </div>
                <div className="max-h-[330px] overflow-auto rounded-lg border border-white/10">
                  {repos.length ? (
                    <div className="divide-y divide-white/10">
                      {repos.slice(0, 18).map((r) => (
                        <button key={r.id} className="w-full p-3 text-left hover:bg-white/[0.03]" onClick={() => onSelectRepo(r)} type="button">
                          <div className="text-sm font-medium text-zinc-100">{r.full_name}</div>
                          <div className="text-xs text-zinc-500">{r.private ? "private" : "public"} · {r.default_branch}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-zinc-500">{loadingRepos ? "Loading..." : "No repositories"}</div>
                  )}
                </div>
              </div>
            )}
            <Separator className="bg-white/10" />
            <Input value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} placeholder="owner/repo" className="border-white/10 bg-white/[0.02]" />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="text-base">3. Configure and import</CardTitle>
            <CardDescription>Review defaults then create project and open deployment dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Project slug" className="border-white/10 bg-white/[0.02]" />
            <Input value={rootDir} onChange={(e) => setRootDir(e.target.value)} placeholder="Root directory (optional)" className="border-white/10 bg-white/[0.02]" />
            <Input value={buildPreset} onChange={(e) => setBuildPreset(e.target.value)} placeholder="Build preset (optional)" className="border-white/10 bg-white/[0.02]" />

            <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
              <div className="mb-1 text-zinc-200">Recommended for {selectedTemplate.label}</div>
              <ul className="space-y-1">
                {selectedTemplate.hints.map((hint) => (
                  <li key={hint}>- {hint}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={importProject} disabled={!canImport}>Import project</Button>
              <Button asChild variant="outline" className="border-white/15 bg-transparent hover:bg-white/5">
                <Link href="/admin">Configure GitHub App</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
