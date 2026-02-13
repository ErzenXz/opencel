"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, ChevronRight, ExternalLink, GitBranch, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiBase, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

function StatusDot({ status }: { status: string }) {
  const color =
    status === "READY"
      ? "bg-emerald-500"
      : status === "BUILDING" || status === "QUEUED"
        ? "bg-yellow-500"
        : status === "ERROR" || status === "FAILED"
          ? "bg-red-500"
          : "bg-[#555]";
  return (
    <span className="relative flex h-2.5 w-2.5">
      {(status === "BUILDING" || status === "QUEUED") && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            color
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)} />
    </span>
  );
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [logsFor, setLogsFor] = useState<string>("");
  const [logs, setLogs] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"deployments" | "env" | "logs">("deployments");

  type TabItem = { id: string; label: string; href?: string };
  const [envScope, setEnvScope] = useState<"preview" | "production">("preview");
  const [envs, setEnvs] = useState<EnvVar[]>([]);
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");

  const selectedDeployment = useMemo(
    () => deployments.find((d) => d.id === logsFor) || null,
    [deployments, logsFor]
  );

  async function refresh() {
    if (!projectID) return;
    try {
      const p = (await apiFetch(`/api/projects/${projectID}`)) as Project;
      setProject(p);
      const ds = (await apiFetch(
        `/api/projects/${projectID}/deployments`
      )) as Deployment[];
      setDeployments(ds);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  async function refreshEnv(scope: "preview" | "production") {
    if (!projectID) return;
    try {
      const vs = (await apiFetch(
        `/api/projects/${projectID}/env?scope=${scope}`
      )) as EnvVar[];
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
    setActiveTab("logs");
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
      await apiFetch(`/api/deployments/${deploymentID}/promote`, {
        method: "POST",
        body: "{}",
      });
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
        body: JSON.stringify({ scope: envScope, key: envKey, value: envValue }),
      });
      toast.success("Saved env var");
      setEnvKey("");
      setEnvValue("");
      refreshEnv(envScope);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  const tabs: TabItem[] = [
    { id: "deployments", label: "Deployments" },
    { id: "env", label: "Environment Variables" },
    { id: "logs", label: "Logs" },
    { id: "analytics", label: "Analytics", href: `/projects/${projectID}/analytics` },
    { id: "domains", label: "Domains", href: `/projects/${projectID}/domains` },
    { id: "settings", label: "Settings", href: `/projects/${projectID}/settings` },
  ];

  const productionDeployment = deployments.find(
    (d) => d.id === project?.production_deployment_id
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects" className="text-[#888] hover:text-white">
                Projects
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white">
              {project?.slug || "Project"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Project Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {project?.slug || "Project"}
          </h1>
          <div className="flex items-center gap-2 text-sm text-[#888]">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{project?.repo_full_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {productionDeployment?.preview_url && (
            <Button
              asChild
              variant="outline"
              className="gap-2 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
            >
              <a
                href={productionDeployment.preview_url}
                target="_blank"
                rel="noreferrer"
              >
                Visit
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="gap-2 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
          >
            <Link href={`/projects/${projectID}/settings`}>
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Production Status Banner */}
      {productionDeployment && (
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <StatusDot status={productionDeployment.status} />
              <div>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="font-medium">Production Deployment</span>
                  <span className="text-[#555]">·</span>
                  <span className="font-mono text-xs text-[#888]">
                    {productionDeployment.git_sha.slice(0, 7)}
                  </span>
                </div>
                <div className="text-xs text-[#666]">
                  {productionDeployment.git_ref.replace("refs/heads/", "")} ·{" "}
                  {timeAgo(productionDeployment.created_at)}
                </div>
              </div>
            </div>
            {productionDeployment.preview_url && (
              <a
                href={productionDeployment.preview_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-[#0070f3] hover:underline"
              >
                {new URL(productionDeployment.preview_url).hostname}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#333]">
        <nav className="-mb-px flex gap-0">
          {tabs.map((tab) =>
            tab.href ? (
              <Link
                key={tab.id}
                href={tab.href}
                className="relative px-4 py-3 text-sm text-[#888] transition-colors hover:text-[#ededed]"
              >
                {tab.label}
              </Link>
            ) : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "deployments" | "env" | "logs")}
                className={cn(
                  "relative px-4 py-3 text-sm transition-colors",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-[#888] hover:text-[#ededed]"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-white" />
                )}
              </button>
            )
          )}
        </nav>
      </div>

      {/* Tab Content: Deployments */}
      {activeTab === "deployments" && (
        <div>
          {deployments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-16 text-center">
              <p className="text-sm text-[#888]">No deployments yet.</p>
              <p className="mt-1 text-xs text-[#555]">
                Push to GitHub to trigger a deployment.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#333]">
              {/* Table header */}
              <div className="hidden border-b border-[#333] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_1fr_120px_100px_140px]">
                <div>Deployment</div>
                <div>Branch</div>
                <div>Status</div>
                <div>Age</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-[#222]">
                {deployments.map((d) => {
                  const branch = d.git_ref.replace("refs/heads/", "");
                  const isProduction =
                    project?.production_deployment_id === d.id;
                  return (
                    <div
                      key={d.id}
                      className="group grid cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[#0a0a0a] md:grid-cols-[1fr_1fr_120px_100px_140px]"
                      onClick={() => window.location.href = `/projects/${projectID}/deployments/${d.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusDot status={d.status} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white">
                              {d.git_sha.slice(0, 7)}
                            </span>
                            {isProduction && (
                              <Badge className="h-5 rounded-sm bg-[#0070f3]/10 px-1.5 text-[10px] font-medium text-[#0070f3] hover:bg-[#0070f3]/20">
                                Production
                              </Badge>
                            )}
                          </div>
                          {d.preview_url && (
                            <a
                              href={d.preview_url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-xs text-[#0070f3] hover:underline"
                            >
                              {(() => {
                                try {
                                  return new URL(d.preview_url).hostname;
                                } catch {
                                  return d.preview_url;
                                }
                              })()}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-[#888]">
                        <GitBranch className="h-3 w-3 text-[#555]" />
                        <span className="truncate">{branch}</span>
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-[#333] text-xs",
                            d.status === "READY" && "border-emerald-800/50 text-emerald-400",
                            (d.status === "BUILDING" || d.status === "QUEUED") && "border-yellow-800/50 text-yellow-400",
                            (d.status === "ERROR" || d.status === "FAILED") && "border-red-800/50 text-red-400"
                          )}
                        >
                          {d.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-[#666]">
                        {timeAgo(d.created_at)}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-white"
                          onClick={(e) => { e.stopPropagation(); setLogsFor(d.id); }}
                        >
                          Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          className="h-7 px-2 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-white"
                        >
                          <Link href={`/projects/${projectID}/deployments/${d.id}`} onClick={(e) => e.stopPropagation()}>
                            Details
                          </Link>
                        </Button>
                        {!isProduction && d.status === "READY" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-white"
                            onClick={(e) => { e.stopPropagation(); promote(d.id); }}
                          >
                            Promote
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              {selectedDeployment ? (
                <div className="flex items-center gap-2 text-sm">
                  <StatusDot status={selectedDeployment.status} />
                  <span className="font-mono text-[#ededed]">
                    {selectedDeployment.id.slice(0, 8)}
                  </span>
                  <span className="text-[#555]">·</span>
                  <span className="text-[#888]">
                    {selectedDeployment.git_ref.replace("refs/heads/", "")}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[#888]">
                  Select a deployment from the Deployments tab to stream logs.
                </p>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#333]">
            <div className="border-b border-[#222] bg-[#0a0a0a] px-4 py-2">
              <span className="text-xs font-medium text-[#666]">
                Build & Runtime Logs
              </span>
            </div>
            <pre className="min-h-[500px] overflow-auto bg-black p-4 font-mono text-xs leading-6 text-[#ededed]">
              {selectedDeployment
                ? logs || "Waiting for logs..."
                : "No deployment selected."}
            </pre>
          </div>
        </div>
      )}

      {/* Tab Content: Environment Variables */}
      {activeTab === "env" && (
        <div className="space-y-6">
          {/* Scope toggle */}
          <div className="flex gap-2">
            {(["preview", "production"] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setEnvScope(scope)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm capitalize transition-colors",
                  envScope === scope
                    ? "bg-white text-black"
                    : "bg-[#1a1a1a] text-[#888] hover:text-white"
                )}
              >
                {scope}
              </button>
            ))}
          </div>

          {/* Add form */}
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
            <div className="mb-3 text-sm font-medium text-[#ededed]">
              Add Environment Variable
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="KEY"
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
              <Input
                placeholder="value"
                value={envValue}
                onChange={(e) => setEnvValue(e.target.value)}
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
              <Button onClick={setEnv} disabled={!envKey} className="gap-2">
                <Plus className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>

          {/* List */}
          {envs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-12 text-center">
              <p className="text-sm text-[#888]">
                No environment variables set for {envScope}.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#333]">
              <div className="border-b border-[#333] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666]">
                <div className="grid grid-cols-[1fr_120px]">
                  <div>Key</div>
                  <div>Scope</div>
                </div>
              </div>
              <div className="divide-y divide-[#222]">
                {envs.map((v) => (
                  <div
                    key={`${v.scope}:${v.key}`}
                    className="grid grid-cols-[1fr_120px] items-center px-4 py-3"
                  >
                    <div className="font-mono text-sm text-[#ededed]">
                      {v.key}
                    </div>
                    <Badge
                      variant="outline"
                      className="w-fit border-[#333] text-xs text-[#888]"
                    >
                      {v.scope}
                    </Badge>
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
