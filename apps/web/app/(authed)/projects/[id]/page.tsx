"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Logs, Rocket, Server, TerminalSquare } from "lucide-react";
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
    const es = new EventSource(url, { withCredentials: true } as EventSourceInit);
    es.addEventListener("log", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { chunk?: string };
        setLogs((prev) => prev + (data.chunk || ""));
      } catch {
        // ignore
      }
    });
    es.addEventListener("error", () => es.close());
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
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5">
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
        <h1 className="mt-3 text-2xl font-semibold text-white">{project?.slug || "Project"}</h1>
        <p className="mt-1 text-sm text-zinc-400">{project?.repo_full_name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Deployments</div><div className="mt-2 text-2xl font-semibold">{deployments.length}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Production</div><div className="mt-2">{project?.production_deployment_id ? <Badge variant="secondary">Assigned</Badge> : <Badge variant="outline">Not promoted</Badge>}</div></CardContent></Card>
        <Card className="border-white/10 bg-black/20"><CardContent className="p-4"><div className="text-xs text-zinc-500">Log stream</div><div className="mt-2 text-sm text-zinc-300">{selectedDeployment ? selectedDeployment.id.slice(0, 8) : "Idle"}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4" />Deployments</CardTitle>
            <CardDescription>Push to GitHub to trigger a deployment.</CardDescription>
          </CardHeader>
          <CardContent>
            {deployments.length === 0 ? (
              <div className="text-sm text-zinc-500">No deployments yet.</div>
            ) : (
              <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
                {deployments.map((d) => {
                  const branch = d.git_ref.replace("refs/heads/", "");
                  const isPromoted = project?.production_deployment_id === d.id;
                  return (
                    <div key={d.id} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={d.status === "READY" ? "secondary" : "outline"}>{d.status}</Badge>
                        <Badge variant="outline">{d.type}</Badge>
                        {isPromoted ? <Badge>live</Badge> : null}
                      </div>
                      <div className="text-sm text-zinc-400">{branch} · {d.git_sha.slice(0, 7)}</div>
                      {d.preview_url ? (
                        <a className="inline-flex items-center gap-1 text-sm text-zinc-200 underline" href={d.preview_url} target="_blank" rel="noreferrer">
                          Open preview <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-zinc-500">{new Date(d.created_at).toLocaleString()}</div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={() => setLogsFor(d.id)}>
                            <Logs className="mr-1.5 h-3.5 w-3.5" />Logs
                          </Button>
                          <Button size="sm" onClick={() => promote(d.id)}>Promote</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TerminalSquare className="h-4 w-4" />Live logs</CardTitle>
            <CardDescription>{selectedDeployment ? `Streaming ${selectedDeployment.id.slice(0, 8)}` : "Select a deployment to stream logs."}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="min-h-[430px] whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/50 p-4 text-xs leading-5 text-zinc-300">
              {selectedDeployment ? logs || "(waiting for logs...)" : ""}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" />Environment variables</CardTitle>
          <CardDescription>Values are write-only. Configure preview and production independently.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={envScope} onValueChange={(v) => setEnvScope(v as "preview" | "production") }>
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" />
            <TabsContent value="production" />
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="DATABASE_URL" value={envKey} onChange={(e) => setEnvKey(e.target.value)} className="border-white/10 bg-white/[0.02]" />
            <Input placeholder="(write-only)" value={envValue} onChange={(e) => setEnvValue(e.target.value)} className="border-white/10 bg-white/[0.02]" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={setEnv} disabled={!envKey}>Save</Button>
            <Button variant="outline" className="border-white/15 bg-transparent hover:bg-white/5" onClick={() => refreshEnv(envScope)}>Refresh</Button>
          </div>

          <Separator className="bg-white/10" />

          {envs.length === 0 ? (
            <div className="text-sm text-zinc-500">No env vars set for {envScope}.</div>
          ) : (
            <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
              {envs.map((v) => (
                <div key={`${v.scope}:${v.key}`} className="flex items-center justify-between px-4 py-3">
                  <div className="font-mono text-sm text-zinc-200">{v.key}</div>
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
