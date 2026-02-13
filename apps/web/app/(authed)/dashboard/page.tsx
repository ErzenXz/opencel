"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Globe,
  Import,
  Plus,
  Rocket,
  Settings,
  Users,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/activity-feed";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
  created_at: string;
  production_deployment_id?: string | null;
};

type Deployment = {
  id: string;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalDeployments: 0,
    activeDeployments: 0,
    productionProjects: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const orgID = getStoredOrgID();
      if (!orgID) {
        setLoading(false);
        return;
      }
      try {
        const ps = (await apiFetch(
          `/api/orgs/${orgID}/projects`
        )) as Project[];
        setProjects(ps);

        let totalDeploys = 0;
        let activeDeploys = 0;
        let prodProjects = 0;

        await Promise.all(
          ps.slice(0, 10).map(async (p) => {
            if (p.production_deployment_id) prodProjects++;
            try {
              const ds = (await apiFetch(
                `/api/projects/${p.id}/deployments`
              )) as Deployment[];
              totalDeploys += ds.length;
              activeDeploys += ds.filter(
                (d) => d.status === "BUILDING" || d.status === "QUEUED"
              ).length;
            } catch {
              // ignore
            }
          })
        );

        setStats({
          totalProjects: ps.length,
          totalDeployments: totalDeploys,
          activeDeployments: activeDeploys,
          productionProjects: prodProjects,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Your deployment overview and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="gap-2 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
          >
            <Link href="/import">
              <Import className="h-3.5 w-3.5" />
              Import
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/projects">
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Projects",
            value: stats.totalProjects,
            icon: Globe,
            href: "/projects",
          },
          {
            label: "Total Deployments",
            value: stats.totalDeployments,
            icon: Rocket,
          },
          {
            label: "In Production",
            value: stats.productionProjects,
            icon: GitBranch,
          },
          {
            label: "Active Builds",
            value: stats.activeDeployments,
            icon: Settings,
            pulse: stats.activeDeployments > 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0a0a0a] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-[#444]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <div className="h-8 w-12 animate-pulse rounded bg-[#1a1a1a]" />
              ) : (
                <span className="text-3xl font-bold tabular-nums text-white">
                  {stat.value}
                </span>
              )}
              {stat.pulse && !loading && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                </span>
              )}
            </div>
            {stat.href && (
              <Link
                href={stat.href}
                className="mt-2 inline-flex items-center gap-1 text-xs text-[#0070f3] hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">
              Recent Activity
            </h2>
            <Link
              href="/projects"
              className="text-xs text-[#888] hover:text-white"
            >
              View all
            </Link>
          </div>
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-3">
            <ActivityFeed limit={8} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-white">Quick Actions</h2>
          <div className="space-y-2">
            {[
              {
                label: "Import Git Repository",
                description: "From GitHub, GitLab, or Bitbucket",
                icon: Import,
                href: "/import",
              },
              {
                label: "View Projects",
                description: "Manage deployed projects",
                icon: Globe,
                href: "/projects",
              },
              {
                label: "Team Members",
                description: "Manage your organization",
                icon: Users,
                href: "/orgs",
              },
              {
                label: "Settings",
                description: "Account & preferences",
                icon: Settings,
                href: "/settings",
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-lg border border-[#333] bg-[#0a0a0a] p-4 transition-colors hover:border-[#555] hover:bg-[#111]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#111] transition-colors group-hover:bg-[#1a1a1a]">
                  <action.icon className="h-4 w-4 text-[#888]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {action.label}
                  </p>
                  <p className="text-xs text-[#666]">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#555] transition-transform group-hover:translate-x-0.5 group-hover:text-[#888]" />
              </Link>
            ))}
          </div>

          {/* Recent Projects */}
          {projects.length > 0 && (
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-medium text-white">
                Recent Projects
              </h2>
              <div className="space-y-1">
                {projects.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#111]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#333] bg-[#111]">
                      <svg
                        height="10"
                        viewBox="0 0 76 65"
                        className="text-[#555]"
                        fill="currentColor"
                      >
                        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{p.slug}</p>
                      <p className="truncate text-xs text-[#666]">
                        {p.repo_full_name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
