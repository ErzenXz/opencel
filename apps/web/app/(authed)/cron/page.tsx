"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

type CronJob = {
  id: string;
  name: string;
  schedule: string;
  path: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: "success" | "failed" | "running" | null;
  nextRun: string;
  avgDuration: number;
  successRate: number;
};

const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "Every month", value: "0 0 1 * *" },
];

const INITIAL_JOBS: CronJob[] = [
  {
    id: "1",
    name: "Database Cleanup",
    schedule: "0 */6 * * *",
    path: "/api/cron/cleanup",
    enabled: true,
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastStatus: "success",
    nextRun: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    avgDuration: 1200,
    successRate: 99.2,
  },
  {
    id: "2",
    name: "Send Weekly Digest",
    schedule: "0 9 * * 1",
    path: "/api/cron/digest",
    enabled: true,
    lastRun: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastStatus: "success",
    nextRun: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    avgDuration: 4500,
    successRate: 97.8,
  },
  {
    id: "3",
    name: "Sync External Data",
    schedule: "*/15 * * * *",
    path: "/api/cron/sync",
    enabled: false,
    lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    lastStatus: "failed",
    nextRun: "—",
    avgDuration: 800,
    successRate: 85.0,
  },
  {
    id: "4",
    name: "Generate Sitemap",
    schedule: "0 0 * * *",
    path: "/api/cron/sitemap",
    enabled: true,
    lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    lastStatus: "success",
    nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    avgDuration: 2200,
    successRate: 100,
  },
];

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso: string) {
  if (iso === "—") return "—";
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

function StatusBadge({ status }: { status: CronJob["lastStatus"] }) {
  if (!status) return <span className="text-xs text-[#555]">Never run</span>;
  const map = {
    success: { color: "text-emerald-500", icon: Check, label: "Success" },
    failed: { color: "text-red-500", icon: X, label: "Failed" },
    running: { color: "text-[#0070f3]", icon: RefreshCw, label: "Running" },
  };
  const m = map[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", m.color)}>
      <m.icon
        className={cn("h-3 w-3", status === "running" && "animate-spin")}
      />
      {m.label}
    </span>
  );
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>(INITIAL_JOBS);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("/api/cron/");
  const [newSchedule, setNewSchedule] = useState("0 * * * *");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  function createJob() {
    if (!newName.trim() || !newPath.trim()) return;
    const job: CronJob = {
      id: String(Date.now()),
      name: newName.trim(),
      schedule: newSchedule,
      path: newPath.trim(),
      enabled: true,
      lastRun: null,
      lastStatus: null,
      nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      avgDuration: 0,
      successRate: 0,
    };
    setJobs((p) => [job, ...p]);
    setNewName("");
    setNewPath("/api/cron/");
    setNewSchedule("0 * * * *");
    setShowCreate(false);
  }

  function toggleJob(id: string) {
    setJobs((p) =>
      p.map((j) =>
        j.id === id
          ? {
              ...j,
              enabled: !j.enabled,
              nextRun: j.enabled
                ? "—"
                : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }
          : j
      )
    );
  }

  function deleteJob(id: string) {
    setJobs((p) => p.filter((j) => j.id !== id));
    setMenuOpen(null);
  }

  function runNow(id: string) {
    setJobs((p) =>
      p.map((j) =>
        j.id === id
          ? { ...j, lastStatus: "running" as const, lastRun: new Date().toISOString() }
          : j
      )
    );
    setMenuOpen(null);
    setTimeout(() => {
      setJobs((p) =>
        p.map((j) =>
          j.id === id ? { ...j, lastStatus: "success" as const } : j
        )
      );
    }, 2000);
  }

  const enabledCount = jobs.filter((j) => j.enabled).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Cron Jobs
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Schedule recurring tasks for your applications.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-[#ccc]"
        >
          <Plus className="h-4 w-4" />
          Create Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-3">
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Total Jobs
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {jobs.length}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Active
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-500">
            {enabledCount}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
            Failed (24h)
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-red-500">
            {jobs.filter((j) => j.lastStatus === "failed").length}
          </p>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">
              Create Cron Job
            </h2>
            <button
              onClick={() => setShowCreate(false)}
              className="text-[#666] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[#888]">
                Job Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Daily Report"
                className="h-9 w-full rounded-md border border-[#333] bg-black px-3 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#888]">
                API Path
              </label>
              <input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="h-9 w-full rounded-md border border-[#333] bg-black px-3 font-mono text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs text-[#888]">
              Schedule (cron expression)
            </label>
            <input
              value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              className="h-9 w-full rounded-md border border-[#333] bg-black px-3 font-mono text-sm text-white placeholder-[#555] outline-none focus:border-[#555] sm:max-w-xs"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setNewSchedule(p.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition-colors",
                    newSchedule === p.value
                      ? "bg-white text-black"
                      : "bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-[#333] px-4 py-2 text-sm text-[#888] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={createJob}
              disabled={!newName.trim()}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-[#ccc] disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Jobs list */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Clock className="h-10 w-10 text-[#333]" />
          <p className="mt-3 text-sm font-medium text-white">
            No cron jobs yet
          </p>
          <p className="mt-1 text-xs text-[#888]">
            Create your first scheduled job to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#333]">
          {/* Header */}
          <div className="hidden border-b border-[#333] bg-[#111] px-4 py-2.5 sm:grid sm:grid-cols-12 sm:gap-4">
            <span className="col-span-3 text-xs font-medium text-[#666]">
              Name
            </span>
            <span className="col-span-2 text-xs font-medium text-[#666]">
              Schedule
            </span>
            <span className="col-span-2 text-xs font-medium text-[#666]">
              Last Run
            </span>
            <span className="col-span-2 text-xs font-medium text-[#666]">
              Next Run
            </span>
            <span className="col-span-1 text-xs font-medium text-[#666]">
              Status
            </span>
            <span className="col-span-2 text-xs font-medium text-right text-[#666]">
              Actions
            </span>
          </div>
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              className={cn(
                "group px-4 py-3 transition-colors hover:bg-[#111] sm:grid sm:grid-cols-12 sm:items-center sm:gap-4",
                idx > 0 && "border-t border-[#333]",
                !job.enabled && "opacity-60"
              )}
            >
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  <Zap
                    className={cn(
                      "h-4 w-4",
                      job.enabled ? "text-[#0070f3]" : "text-[#555]"
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {job.name}
                    </p>
                    <p className="font-mono text-xs text-[#555]">
                      {job.path}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <code className="rounded bg-[#1a1a1a] px-2 py-0.5 text-xs text-[#ededed]">
                  {job.schedule}
                </code>
              </div>
              <div className="col-span-2 text-xs text-[#888]">
                {timeAgo(job.lastRun)}
              </div>
              <div className="col-span-2 text-xs text-[#888]">
                {job.enabled ? timeUntil(job.nextRun) : "—"}
              </div>
              <div className="col-span-1">
                <StatusBadge status={job.lastStatus} />
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => toggleJob(job.id)}
                  className={cn(
                    "rounded-md p-1.5 text-xs transition-colors",
                    job.enabled
                      ? "text-[#888] hover:text-yellow-500"
                      : "text-[#888] hover:text-emerald-500"
                  )}
                  title={job.enabled ? "Pause" : "Resume"}
                >
                  {job.enabled ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === job.id ? null : job.id)
                    }
                    className="rounded-md p-1.5 text-[#888] hover:text-white"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {menuOpen === job.id && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-[#333] bg-[#1a1a1a] shadow-lg">
                      <button
                        onClick={() => runNow(job.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#ededed] hover:bg-[#222]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Run Now
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-[#222]"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
        <div>
          <p className="text-sm font-medium text-yellow-500">
            Cron Job Limits
          </p>
          <p className="mt-1 text-xs leading-5 text-[#888]">
            Hobby plans support up to 2 cron jobs with a minimum interval of 1
            hour. Pro plans support unlimited jobs with 1-minute intervals.
            Enterprise plans include priority execution and SLA guarantees.
          </p>
        </div>
      </div>
    </div>
  );
}
