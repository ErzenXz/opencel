"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Connect a GitHub repo and deploy on push.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Create project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>Projects are scoped to the selected organization.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
                      <Link href="/settings" className="underline">
                        Settings
                      </Link>
                      .
                    </span>
                  )}
                </div>
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
        <CardContent className="space-y-3">
          {!orgID ? (
            <div className="text-sm text-muted-foreground">No organization selected.</div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-muted-foreground">No projects yet.</div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {projects.map((p) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

