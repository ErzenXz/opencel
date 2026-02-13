"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, GitCommit, Rocket, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
  org_id: string;
};

type Deployment = {
  id: string;
  project_id: string;
  git_sha: string;
  git_ref: string;
  status: string;
  type: string;
  preview_url?: string | null;
  created_at: string;
};

type ActivityItem = {
  deployment: Deployment;
  project: Project;
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "READY":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "BUILDING":
    case "QUEUED":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "ERROR":
    case "FAILED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-[#555]" />;
  }
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const orgID = getStoredOrgID();
      if (!orgID) {
        setLoading(false);
        return;
      }
      try {
        const projects = (await apiFetch(
          `/api/orgs/${orgID}/projects`
        )) as Project[];
        const items: ActivityItem[] = [];
        await Promise.all(
          projects.slice(0, 8).map(async (p) => {
            try {
              const ds = (await apiFetch(
                `/api/projects/${p.id}/deployments`
              )) as Deployment[];
              for (const d of ds.slice(0, 3)) {
                items.push({ deployment: d, project: p });
              }
            } catch {
              // ignore
            }
          })
        );
        items.sort(
          (a, b) =>
            new Date(b.deployment.created_at).getTime() -
            new Date(a.deployment.created_at).getTime()
        );
        setActivity(items.slice(0, limit));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-[#222] bg-[#0a0a0a] p-3"
          >
            <div className="h-4 w-4 rounded-full bg-[#1a1a1a]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-[#1a1a1a]" />
              <div className="h-2.5 w-48 rounded bg-[#1a1a1a]" />
            </div>
            <div className="h-2.5 w-12 rounded bg-[#1a1a1a]" />
          </div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-8 text-center">
        <Rocket className="mb-2 h-5 w-5 text-[#555]" />
        <p className="text-sm text-[#888]">No recent activity.</p>
        <p className="mt-0.5 text-xs text-[#555]">
          Deployments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((item) => {
        const branch = item.deployment.git_ref.replace("refs/heads/", "");
        return (
          <Link
            key={item.deployment.id}
            href={`/projects/${item.project.id}/deployments/${item.deployment.id}`}
            className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#111]"
          >
            <div className="mt-0.5">
              <StatusIcon status={item.deployment.status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-white">
                  {item.project.slug}
                </span>
                <span className="text-[#555]">·</span>
                <span
                  className={cn(
                    "text-xs",
                    item.deployment.status === "READY"
                      ? "text-emerald-400"
                      : item.deployment.status === "ERROR" ||
                          item.deployment.status === "FAILED"
                        ? "text-red-400"
                        : "text-[#888]"
                  )}
                >
                  {item.deployment.status}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[#666]">
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span className="truncate">{branch}</span>
                </div>
                <span className="text-[#333]">·</span>
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" />
                  <span className="font-mono">
                    {item.deployment.git_sha.slice(0, 7)}
                  </span>
                </div>
              </div>
            </div>
            <span className="mt-0.5 whitespace-nowrap text-xs text-[#555]">
              {timeAgo(item.deployment.created_at)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
