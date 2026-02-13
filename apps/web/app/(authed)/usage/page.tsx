"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  Database,
  Globe,
  HardDrive,
  Rocket,
  Server,
  TrendingUp,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";

type Project = { id: string; slug: string };
type Deployment = { id: string; status: string; created_at: string };

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function ProgressBar({
  value,
  max,
  color = "bg-white",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full rounded-full bg-[#222]">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function UsagePage() {
  const [projectCount, setProjectCount] = useState(0);
  const [deployCount, setDeployCount] = useState(0);
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
        setProjectCount(ps.length);
        let total = 0;
        await Promise.all(
          ps.slice(0, 10).map(async (p) => {
            try {
              const ds = (await apiFetch(
                `/api/projects/${p.id}/deployments`
              )) as Deployment[];
              total += ds.length;
            } catch {
              // ignore
            }
          })
        );
        setDeployCount(total);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Simulated usage data
  const bandwidth = {
    used: 87.3 * 1024 * 1024 * 1024,
    limit: 100 * 1024 * 1024 * 1024,
  };
  const buildMinutes = { used: 342, limit: 6000 };
  const serverless = { used: 820000, limit: 1000000 };
  const edgeRequests = { used: 2400000, limit: 10000000 };
  const imageOpt = { used: 4200, limit: 5000 };
  const dataTransfer = {
    used: 12.7 * 1024 * 1024 * 1024,
    limit: 40 * 1024 * 1024 * 1024,
  };

  const sections = [
    {
      title: "Bandwidth",
      icon: Globe,
      used: formatBytes(bandwidth.used),
      limit: formatBytes(bandwidth.limit),
      pct: (bandwidth.used / bandwidth.limit) * 100,
      color: "bg-[#0070f3]",
    },
    {
      title: "Build Minutes",
      icon: Clock,
      used: `${buildMinutes.used} min`,
      limit: `${(buildMinutes.limit / 1000).toFixed(0)}k min`,
      pct: (buildMinutes.used / buildMinutes.limit) * 100,
      color: "bg-emerald-500",
    },
    {
      title: "Serverless Invocations",
      icon: Server,
      used: `${(serverless.used / 1000).toFixed(0)}k`,
      limit: `${(serverless.limit / 1000000).toFixed(0)}M`,
      pct: (serverless.used / serverless.limit) * 100,
      color: "bg-purple-500",
    },
    {
      title: "Edge Requests",
      icon: Zap,
      used: `${(edgeRequests.used / 1000000).toFixed(1)}M`,
      limit: `${(edgeRequests.limit / 1000000).toFixed(0)}M`,
      pct: (edgeRequests.used / edgeRequests.limit) * 100,
      color: "bg-yellow-500",
    },
    {
      title: "Image Optimizations",
      icon: BarChart3,
      used: `${(imageOpt.used / 1000).toFixed(1)}k`,
      limit: `${(imageOpt.limit / 1000).toFixed(0)}k`,
      pct: (imageOpt.used / imageOpt.limit) * 100,
      color: "bg-orange-500",
    },
    {
      title: "Data Transfer",
      icon: HardDrive,
      used: formatBytes(dataTransfer.used),
      limit: formatBytes(dataTransfer.limit),
      pct: (dataTransfer.used / dataTransfer.limit) * 100,
      color: "bg-cyan-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Usage
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Resource usage for the current billing period.
        </p>
      </div>

      {/* Plan banner */}
      <div className="flex items-center justify-between rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0070f3]/10">
            <Rocket className="h-5 w-5 text-[#0070f3]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Pro Plan</p>
            <p className="text-xs text-[#888]">
              Billing period: Feb 1 – Feb 28, 2026
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-white">$20</p>
          <p className="text-xs text-[#666]">per month</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Projects
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {loading ? "—" : projectCount}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Deployments
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {loading ? "—" : deployCount}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Bandwidth Used
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            87.3 <span className="text-lg text-[#888]">GB</span>
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Build Minutes
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            342 <span className="text-lg text-[#888]">min</span>
          </p>
        </div>
      </div>

      {/* Usage breakdown */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-white">
          Resource Usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <div
              key={s.title}
              className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-[#666]" />
                  <span className="text-sm font-medium text-white">
                    {s.title}
                  </span>
                </div>
                <span className="text-xs text-[#888]">
                  {s.used}{" "}
                  <span className="text-[#555]">/ {s.limit}</span>
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={s.pct}
                  max={100}
                  color={s.color}
                />
              </div>
              <div className="mt-2 text-right text-xs text-[#666]">
                {s.pct.toFixed(1)}% used
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spending breakdown */}
      <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#666]" />
          <span className="text-sm font-medium text-white">
            Spending Breakdown
          </span>
        </div>
        <div className="space-y-3">
          {[
            { item: "Pro Plan (Base)", amount: "$20.00" },
            { item: "Additional Bandwidth", amount: "$0.00" },
            { item: "Serverless Compute", amount: "$0.00" },
            {
              item: "Storage (Postgres)",
              amount: "$0.00",
              icon: Database,
            },
            { item: "Storage (Redis)", amount: "$0.00", icon: Zap },
          ].map((line) => (
            <div
              key={line.item}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2 text-sm text-[#888]">
                {line.icon && <line.icon className="h-3.5 w-3.5 text-[#555]" />}
                {line.item}
              </div>
              <span className="font-mono text-sm text-[#ededed]">
                {line.amount}
              </span>
            </div>
          ))}
          <div className="border-t border-[#333] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                Total (this period)
              </span>
              <span className="font-mono text-lg font-bold text-white">
                $20.00
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
