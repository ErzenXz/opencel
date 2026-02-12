"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers3, PlusCircle, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_TEMPLATES, getProjectTemplate, type ProjectTemplate } from "@/lib/project-templates";

type Project = {
  id: string;
  org_id: string;
  slug: string;
  repo_full_name: string;
  created_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [templateID, setTemplateID] = useState<ProjectTemplate["id"]>("web-service");
  const [slug, setSlug] = useState("");
  const [repo, setRepo] = useState("");
  const [gh, setGh] = useState<{ configured: boolean; app_id?: string } | null>(null);

  const orgID = useMemo(() => getStoredOrgID(), []);

  async function refresh() {
    if (!orgID) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ps = (await apiFetch(`/api/orgs/${orgID}/projects`)) as Project[];
      setProjects(ps);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    (async () => {
      try {
        const st = (await apiFetch("/api/integrations/github/status")) as { configured: boolean; app_id?: string };
        setGh(st);
      } catch {
        setGh(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!orgID) return;
    try {
      const p = (await apiFetch(`/api/orgs/${orgID}/projects`, {
        method: "POST",
        body: JSON.stringify({ slug, repo_full_name: repo })
      })) as Project;
      setProjects((prev) => [p, ...prev]);
      setSlug("");
      setRepo("");
      setCreateOpen(false);
      toast.success("Project created");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.slug.toLowerCase().includes(q) || p.repo_full_name.toLowerCase().includes(q));
  }, [projects, query]);

  const selectedTemplate = getProjectTemplate(templateID);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500"><Sparkles className="h-3.5 w-3.5" />Deployment Workspace</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">Projects</h1>
            <p className="mt-1 text-sm text-zinc-400">Create and ship services with Vercel-like previews and production promotion.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-white/15 bg-transparent hover:bg-white/5"><Link href="/import">Import</Link></Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><PlusCircle className="h-4 w-4" />Create project</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create project</DialogTitle>
                  <DialogDescription>Projects are scoped to the active organization.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Project type</div>
                    <Select
                      value={templateID}
                      onValueChange={(v) => {
                        const id = v as ProjectTemplate["id"];
                        const template = getProjectTemplate(id);
                        setTemplateID(id);
                        if (!repo || repo.includes("owner/")) setRepo(template.suggestedRepo);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select project type" /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_TEMPLATES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-zinc-500">{selectedTemplate.description}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Slug</div>
                    <Input placeholder="my-app" value={slug} onChange={(e) => setSlug(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">GitHub repo</div>
                    <Input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                    <div className="mb-1 flex items-center gap-2 text-zinc-200"><Layers3 className="h-3.5 w-3.5" />Suggested setup for {selectedTemplate.label}</div>
                    <ul className="space-y-1">
                      {selectedTemplate.hints.map((hint) => (
                        <li key={hint}>- {hint}</li>
                      ))}
                    </ul>
                    {!gh?.configured ? <div className="mt-2 text-zinc-500">GitHub App is not configured yet. Configure it in Admin.</div> : null}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={onCreate} disabled={!slug || !repo}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Total projects</div><div className="mt-2 text-2xl font-semibold">{projects.length}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">GitHub App</div><div className="mt-2">{gh?.configured ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not configured</Badge>}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Search scope</div><div className="mt-2 text-sm text-zinc-300">{query ? `Filtering: ${query}` : "All projects"}</div></CardContent></Card>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Project list</CardTitle>
              <CardDescription>Open a project to inspect deployments and logs.</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} className="border-white/10 bg-white/[0.02] pl-9" placeholder="Search projects..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!orgID ? (
            <div className="text-sm text-zinc-500">No organization selected.</div>
          ) : loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-sm text-zinc-500">No projects found.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="hidden grid-cols-[1fr_1fr_170px_120px] gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500 md:grid">
                <div>Project</div>
                <div>Repository</div>
                <div>Created</div>
                <div></div>
              </div>
              <div className="divide-y divide-white/10">
                {filteredProjects.map((p) => (
                  <div key={p.id} className="grid items-center gap-2 px-4 py-3 md:grid-cols-[1fr_1fr_170px_120px] md:gap-4">
                    <div className="min-w-0 text-sm font-medium text-zinc-100">{p.slug}</div>
                    <div className="min-w-0 truncate text-sm text-zinc-400">{p.repo_full_name}</div>
                    <div className="text-xs text-zinc-500">{new Date(p.created_at).toLocaleString()}</div>
                    <div className="flex justify-start md:justify-end">
                      <Button asChild size="sm" variant="outline" className="border-white/15 bg-transparent hover:bg-white/5">
                        <Link href={`/projects/${p.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Separator className="my-4 bg-white/10" />
          <div className="text-xs text-zinc-500">Tip: use <span className="font-mono">opencel update --build</span> on your VPS to roll out UI and runtime fixes together.</div>
        </CardContent>
      </Card>
    </div>
  );
}
