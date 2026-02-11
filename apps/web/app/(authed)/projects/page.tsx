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
        const st = (await apiFetch("/api/integrations/github/status")) as any;
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
  const withDeployments = projects.length;
  const hasOrg = Boolean(orgID);
  const hasSearch = query.trim().length > 0;

  function applyTemplate(id: ProjectTemplate["id"]) {
    const template = getProjectTemplate(id);
    setTemplateID(id);
    if (!repo) setRepo(template.suggestedRepo);
  }

  let projectsContent: React.ReactNode;
  if (!hasOrg) {
    projectsContent = <div className="text-sm text-muted-foreground">No organization selected.</div>;
  } else if (loading) {
    projectsContent = (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else if (filteredProjects.length === 0) {
    projectsContent = <div className="text-sm text-muted-foreground">{hasSearch ? "No projects match your search." : "No projects yet."}</div>;
  } else {
    projectsContent = (
      <div className="divide-y divide-border rounded-lg border">
        {filteredProjects.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium truncate">{p.slug}</div>
              <div className="text-sm text-muted-foreground truncate">{p.repo_full_name}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground hidden sm:block">{new Date(p.created_at).toLocaleString()}</div>
              <Separator className="hidden sm:block w-px h-6" />
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${p.id}`}>Open</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_100%_0%,hsl(var(--primary)/0.12),transparent)]" />
        <CardHeader className="relative">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            OpenCel Control Plane
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Ship faster with a Vercel-style project workspace</CardTitle>
          <CardDescription className="max-w-2xl text-sm sm:text-base">
            Create and manage web services, static pages, and database tooling projects. Connect any GitHub repository and deploy with previews.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-border/70 bg-background/40">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total projects</div>
                <div className="mt-1 text-2xl font-semibold">{projects.length}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-background/40">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Deployable repos</div>
                <div className="mt-1 text-2xl font-semibold">{withDeployments}</div>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-background/40">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">GitHub status</div>
                <div className="mt-1 text-sm font-medium">{gh?.configured ? "Connected and ready" : "Not configured yet"}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create from template</CardTitle>
          <CardDescription>Start with a recommended profile, then map it to your repository.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PROJECT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  applyTemplate(template.id);
                  setCreateOpen(true);
                }}
                className="rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background/80">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant="outline">Template</Badge>
                </div>
                <div className="mt-3 font-medium">{template.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{template.description}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Search projects or repos..." />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/import">Import</Link>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>Projects are scoped to the selected organization and backed by GitHub repos.</DialogDescription>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">{selectedTemplate.description}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Slug</div>
                  <Input placeholder="my-app" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">GitHub repo</div>
                  <Input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
                  <div className="text-xs text-muted-foreground">
                    {gh?.configured ? (
                      <span>GitHub App configured.</span>
                    ) : (
                      <span>
                        GitHub App not configured yet. You can create the project now, but deploy-on-push won&apos;t work until you configure it in{" "}
                        <Link href="/admin" className="underline">
                          Admin
                        </Link>
                        .
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                    <Layers3 className="h-3.5 w-3.5" />
                    Suggested setup for {selectedTemplate.label}
                  </div>
                  <ul className="space-y-1">
                    {selectedTemplate.hints.map((hint) => (
                      <li key={hint}>- {hint}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={onCreate} disabled={!slug || !repo}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
          <CardDescription>
            {gh?.configured ? (
              <span className="inline-flex items-center gap-2">
                <Badge variant="secondary">GitHub connected</Badge>
                <span>Push to deploy previews. Promote to production from a deployment.</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Badge variant="outline">GitHub not configured</Badge>
                <span>Configure GitHub in Settings to enable deploy-on-push.</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">{projectsContent}</CardContent>
      </Card>
    </div>
  );
}
