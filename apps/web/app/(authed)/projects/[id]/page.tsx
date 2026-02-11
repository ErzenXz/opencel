"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { apiBase, apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
  org_id: string;
  created_at: string;
  production_deployment_id?: string | null;
};

type Deployment = {
  id: string;
  project_id: string;
  git_sha: string;
  git_ref: string;
  type: string;
  status: string;
  preview_url?: string | null;
  created_at: string;
};

type EnvVar = { scope: string; key: string };

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [logsFor, setLogsFor] = useState<string>("");
  const [logs, setLogs] = useState<string>("");
  const [envScope, setEnvScope] = useState<"preview" | "production">("preview");
  const [envs, setEnvs] = useState<EnvVar[]>([]);
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");

  const selectedDeployment = useMemo(() => deployments.find((d) => d.id === logsFor) || null, [deployments, logsFor]);

  async function refresh() {
    if (!projectID) return;
    try {
      const p = (await apiFetch(`/api/projects/${projectID}`)) as Project;
      setProject(p);
      const ds = (await apiFetch(`/api/projects/${projectID}/deployments`)) as Deployment[];
      setDeployments(ds);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  async function refreshEnv(scope: "preview" | "production") {
    if (!projectID) return;
    try {
      const vs = (await apiFetch(`/api/projects/${projectID}/env?scope=${scope}`)) as EnvVar[];
      setEnvs(vs);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  useEffect(() => {
    refresh();
    refreshEnv(envScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectID]);

  useEffect(() => {
    refreshEnv(envScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envScope]);

  useEffect(() => {
    if (!logsFor) return;
    setLogs("");
    const url = `${apiBase()}/api/deployments/${logsFor}/logs`;
    const es = new EventSource(url, { withCredentials: true } as any);
    es.addEventListener("log", (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        setLogs((prev) => prev + (data.chunk || ""));
      } catch {
        // ignore
      }
    });
    es.addEventListener("error", () => {
      es.close();
    });
    return () => es.close();
  }, [logsFor]);

  async function promote(deploymentID: string) {
    try {
      await apiFetch(`/api/deployments/${deploymentID}/promote`, { method: "POST", body: "{}" });
      toast.success("Promoted to production");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  async function setEnv() {
    if (!envKey) return;
    try {
      await apiFetch(`/api/projects/${projectID}/env`, {
        method: "POST",
        body: JSON.stringify({ scope: envScope, key: envKey, value: envValue })
      });
      toast.success("Saved env var");
      setEnvKey("");
      setEnvValue("");
      refreshEnv(envScope);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/projects">Projects</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{project?.slug || "Project"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-semibold tracking-tight">{project?.slug || "Project"}</h1>
          <div className="text-sm text-muted-foreground">{project?.repo_full_name}</div>
        </div>
        <Button variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Deployments</CardTitle>
            <CardDescription>Push to GitHub to trigger a deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deployments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No deployments yet.</div>
            ) : (
              <div className="divide-y divide-border rounded-lg border">
                {deployments.map((d) => {
                  const branch = d.git_ref.replace("refs/heads/", "");
                  const isProd = d.type === "production";
                  const isPromoted = project?.production_deployment_id === d.id;
                  return (
                    <div key={d.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={d.status === "READY" ? "secondary" : "outline"}>{d.status}</Badge>
                            {isProd ? <Badge variant="outline">production</Badge> : <Badge variant="outline">preview</Badge>}
                            {isPromoted ? <Badge>live</Badge> : null}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground truncate">
                            {branch} · {d.git_sha.slice(0, 7)}
                          </div>
                          {d.preview_url ? (
                            <div className="mt-2 text-sm">
                              <a className="underline" href={d.preview_url} target="_blank" rel="noreferrer">
                                {d.preview_url}
                              </a>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setLogsFor(d.id)}>
                              Logs
                            </Button>
                            <Button size="sm" onClick={() => promote(d.id)}>
                              Promote
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>{selectedDeployment ? `Streaming logs for ${selectedDeployment.id.slice(0, 8)}...` : "Select a deployment."}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="min-h-[420px] whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 text-xs leading-5">
              {selectedDeployment ? logs || "(waiting for logs...)" : ""}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment variables</CardTitle>
          <CardDescription>Stored encrypted. Values are write-only in the UI for now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={envScope} onValueChange={(v) => setEnvScope(v as any)}>
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" />
            <TabsContent value="production" />
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Key</div>
              <Input placeholder="DATABASE_URL" value={envKey} onChange={(e) => setEnvKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Value</div>
              <Input placeholder="(write-only)" value={envValue} onChange={(e) => setEnvValue(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={setEnv} disabled={!envKey}>
              Save
            </Button>
            <Button variant="outline" onClick={() => refreshEnv(envScope)}>
              Refresh
            </Button>
          </div>

          <Separator />

          {envs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No env vars set for {envScope}.</div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {envs.map((v) => (
                <div key={`${v.scope}:${v.key}`} className="p-3 flex items-center justify-between">
                  <div className="font-mono text-sm">{v.key}</div>
                  <Badge variant="outline">{v.scope}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

