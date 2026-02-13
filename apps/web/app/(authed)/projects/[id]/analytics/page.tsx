"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronRight,
  Clock,
  GitCommit,
  Minus,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
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
};

type Deployment = {
  id: string;
  status: string;
  git_sha: string;
  git_ref: string;
  created_at: string;
};

function computeStats(deployments: Deployment[]) {
  const total = deployments.length;
  const successful = deployments.filter((d) => d.status === "READY").length;
  const failed = deployments.filter(
    (d) => d.status === "ERROR" || d.status === "FAILED"
  ).length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  // Deployments per day (last 7 days)
  const now = Date.now();
  const oneDay = 86400000;
  const last7Days = deployments.filter(
    (d) => now - new Date(d.created_at).getTime() < 7 * oneDay
  ).length;
  const prev7Days = deployments.filter(
    (d) =>
      now - new Date(d.created_at).getTime() >= 7 * oneDay &&
      now - new Date(d.created_at).getTime() < 14 * oneDay
  ).length;
  const deploymentsTrend =
    prev7Days === 0 ? 0 : Math.round(((last7Days - prev7Days) / prev7Days) * 100);

  // Unique branches
  const branches = new Set(
    deployments.map((d) => d.git_ref.replace("refs/heads/", ""))
  );

  // Daily deployment counts (last 14 days) for chart
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now - i * oneDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + oneDay);
    const count = deployments.filter((d) => {
      const t = new Date(d.created_at).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    dailyCounts.push({
      date: dayStart.toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      }),
      count,
    });
  }

  return {
    total,
    successful,
    failed,
    successRate,
    last7Days,
    deploymentsTrend,
    branches: branches.size,
    dailyCounts,
  };
}

function MiniBarChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="group relative flex flex-col items-center flex-1">
          <div
            className={cn(
              "w-full min-w-[4px] rounded-t-sm transition-colors",
              d.count > 0
                ? "bg-[#0070f3] hover:bg-[#0070f3]/80"
                : "bg-[#222]"
            )}
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
          />
          <div className="absolute -top-8 hidden rounded bg-[#333] px-2 py-1 text-[10px] text-white group-hover:block whitespace-nowrap z-10">
            {d.count} deploy{d.count !== 1 ? "s" : ""} · {d.date}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-[#666]">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs",
        value > 0 ? "text-emerald-400" : "text-red-400"
      )}
    >
      {value > 0 ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {Math.abs(value)}%
    </span>
  );
}

export default function AnalyticsPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectID]);

  const stats = computeStats(deployments);

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
            <BreadcrumbPage className="text-white">Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Deployment metrics for {project?.slug || "your project"}.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-lg border border-[#333] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                  Total Deployments
                </span>
                <Rocket className="h-4 w-4 text-[#444]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-white">
                  {stats.total}
                </span>
              </div>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                  Success Rate
                </span>
                <TrendingUp className="h-4 w-4 text-[#444]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-white">
                  {stats.successRate}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[#222]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    stats.successRate >= 90
                      ? "bg-emerald-500"
                      : stats.successRate >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                  Last 7 Days
                </span>
                <Clock className="h-4 w-4 text-[#444]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-white">
                  {stats.last7Days}
                </span>
                <TrendBadge value={stats.deploymentsTrend} />
              </div>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                  Active Branches
                </span>
                <GitCommit className="h-4 w-4 text-[#444]" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold tabular-nums text-white">
                  {stats.branches}
                </span>
              </div>
            </div>
          </div>

          {/* Deployment Frequency Chart */}
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#666]" />
                <span className="text-sm font-medium text-white">
                  Deployment Frequency
                </span>
              </div>
              <span className="text-xs text-[#666]">Last 14 days</span>
            </div>
            <MiniBarChart data={stats.dailyCounts} />
            <div className="mt-2 flex justify-between text-[10px] text-[#555]">
              <span>{stats.dailyCounts[0]?.date}</span>
              <span>{stats.dailyCounts[stats.dailyCounts.length - 1]?.date}</span>
            </div>
          </div>

          {/* Recent Deployments Summary */}
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
            <h3 className="mb-4 text-sm font-medium text-white">
              Recent Deployments
            </h3>
            <div className="space-y-2">
              {deployments.slice(0, 10).map((d) => (
                <Link
                  key={d.id}
                  href={`/projects/${projectID}/deployments/${d.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[#111]"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      d.status === "READY"
                        ? "bg-emerald-500"
                        : d.status === "ERROR" || d.status === "FAILED"
                          ? "bg-red-500"
                          : d.status === "BUILDING" || d.status === "QUEUED"
                            ? "bg-yellow-500"
                            : "bg-[#555]"
                    )}
                  />
                  <span className="font-mono text-xs text-[#ededed]">
                    {d.git_sha.slice(0, 7)}
                  </span>
                  <span className="text-xs text-[#666]">
                    {d.git_ref.replace("refs/heads/", "")}
                  </span>
                  <span className="ml-auto text-xs text-[#555]">
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
