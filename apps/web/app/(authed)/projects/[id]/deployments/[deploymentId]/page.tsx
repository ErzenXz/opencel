"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiBase, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  image_ref?: string | null;
  container_name?: string | null;
  service_port: number;
  created_at: string;
  updated_at: string;
  promoted_at?: string | null;
};

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
      <span
        className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)}
      />
    </span>
  );
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: string, end?: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffSec = Math.floor((endMs - startMs) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  const sec = diffSec % 60;
  return `${min}m ${sec}s`;
}

export default function DeploymentDetailPage() {
  const params = useParams<{ id: string; deploymentId: string }>();
  const projectID = params?.id;
  const deploymentID = params?.deploymentId;

  const [project, setProject] = useState<Project | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [liveLogging, setLiveLogging] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch project and deployment
  useEffect(() => {
    if (!projectID || !deploymentID) return;
    (async () => {
      try {
        const p = (await apiFetch(`/api/projects/${projectID}`)) as Project;
        setProject(p);
        const d = (await apiFetch(
          `/api/deployments/${deploymentID}`
        )) as Deployment;
        setDeployment(d);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
    })();
  }, [projectID, deploymentID]);

  // Poll deployment status
  useEffect(() => {
    if (!deploymentID) return;
    if (
      deployment?.status === "READY" ||
      deployment?.status === "ERROR" ||
      deployment?.status === "FAILED"
    )
      return;
    const interval = setInterval(async () => {
      try {
        const d = (await apiFetch(
          `/api/deployments/${deploymentID}`
        )) as Deployment;
        setDeployment(d);
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [deploymentID, deployment?.status]);

  // SSE Logs
  useEffect(() => {
    if (!deploymentID) return;
    setLogs("");
    setLiveLogging(true);
    const url = `${apiBase()}/api/deployments/${deploymentID}/logs`;
    const es = new EventSource(url, {
      withCredentials: true,
    } as EventSourceInit);
    es.addEventListener("log", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { chunk?: string };
        setLogs((prev) => prev + (data.chunk || ""));
      } catch {
        // ignore
      }
    });
    es.addEventListener("error", () => {
      setLiveLogging(false);
      es.close();
    });
    return () => {
      es.close();
      setLiveLogging(false);
    };
  }, [deploymentID]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  async function promote() {
    if (!deploymentID) return;
    try {
      await apiFetch(`/api/deployments/${deploymentID}/promote`, {
        method: "POST",
        body: "{}",
      });
      toast.success("Promoted to production");
      // Refresh
      const [p, d] = await Promise.all([
        apiFetch(`/api/projects/${projectID}`) as Promise<Project>,
        apiFetch(`/api/deployments/${deploymentID}`) as Promise<Deployment>,
      ]);
      setProject(p);
      setDeployment(d);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  const isProduction =
    project?.production_deployment_id === deployment?.id;
  const branch = deployment?.git_ref.replace("refs/heads/", "") || "";

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
            <BreadcrumbLink asChild>
              <Link
                href={`/projects/${projectID}`}
                className="text-[#888] hover:text-white"
              >
                {project?.slug || "Project"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white">
              {deployment?.id.slice(0, 8) || "Deployment"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Deployment Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StatusDot status={deployment?.status || "QUEUED"} />
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Deployment
            </h1>
            {isProduction && (
              <Badge className="rounded-sm bg-[#0070f3]/10 px-2 text-xs font-medium text-[#0070f3] hover:bg-[#0070f3]/20">
                Production
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#888]">
            <span className="flex items-center gap-1.5">
              <GitCommit className="h-3.5 w-3.5 text-[#555]" />
              <code className="font-mono text-[#ededed]">
                {deployment?.git_sha.slice(0, 7)}
              </code>
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-[#555]" />
              {branch}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#555]" />
              {deployment
                ? timeAgo(deployment.created_at)
                : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deployment?.preview_url && (
            <Button
              asChild
              variant="outline"
              className="gap-2 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
            >
              <a
                href={deployment.preview_url}
                target="_blank"
                rel="noreferrer"
              >
                Visit
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {!isProduction && deployment?.status === "READY" && (
            <Button onClick={promote} className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Promote to Production
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-4">
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Status</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusDot status={deployment?.status || "QUEUED"} />
            <span className="text-sm font-medium text-white">
              {deployment?.status || "—"}
            </span>
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Duration</div>
          <div className="mt-1 text-sm text-white">
            {deployment
              ? formatDuration(deployment.created_at, deployment.updated_at)
              : "—"}
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Source</div>
          <div className="mt-1 text-sm text-white">
            {deployment?.type || "—"}
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#666]">Domain</div>
          <div className="mt-1 truncate text-sm">
            {deployment?.preview_url ? (
              <a
                href={deployment.preview_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#0070f3] hover:underline"
              >
                {(() => {
                  try {
                    return new URL(deployment.preview_url).hostname;
                  } catch {
                    return deployment.preview_url;
                  }
                })()}
              </a>
            ) : (
              <span className="text-[#555]">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Deployment Details */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            Deployment Details
          </h2>
        </div>
        <div className="divide-y divide-[#222]">
          {[
            { label: "Deployment ID", value: deployment?.id },
            { label: "Git SHA", value: deployment?.git_sha },
            { label: "Git Ref", value: deployment?.git_ref },
            { label: "Image", value: deployment?.image_ref || "—" },
            {
              label: "Container",
              value: deployment?.container_name || "—",
            },
            {
              label: "Service Port",
              value: String(deployment?.service_port || "—"),
            },
            {
              label: "Created",
              value: deployment
                ? new Date(deployment.created_at).toLocaleString()
                : "—",
            },
            {
              label: "Last Updated",
              value: deployment
                ? new Date(deployment.updated_at).toLocaleString()
                : "—",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-6 py-3"
            >
              <span className="text-sm text-[#888]">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="max-w-[300px] truncate font-mono text-sm text-[#ededed]">
                  {row.value || "—"}
                </span>
                {row.value && row.value !== "—" && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(row.value || "");
                      toast.success("Copied");
                    }}
                    className="shrink-0 text-[#555] transition-colors hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Build Logs with real-time streaming */}
      <section className="rounded-lg border border-[#333]">
        <div className="flex items-center justify-between border-b border-[#333] px-6 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-white">Build Logs</h2>
            {liveLogging && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                autoScroll
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              Auto-scroll {autoScroll ? "on" : "off"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(logs);
                toast.success("Logs copied");
              }}
              className="rounded-md px-2.5 py-1 text-xs text-[#666] transition-colors hover:text-white"
            >
              Copy logs
            </button>
          </div>
        </div>
        <pre
          ref={logRef}
          className="max-h-[600px] min-h-[300px] overflow-auto bg-black p-4 font-mono text-xs leading-6 text-[#ededed]"
        >
          {logs || "Waiting for logs..."}
        </pre>
      </section>
    </div>
  );
}
