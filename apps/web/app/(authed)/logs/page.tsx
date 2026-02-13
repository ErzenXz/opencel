"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  Clock,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Project = {
  id: string;
  slug: string;
};

type Deployment = {
  id: string;
  project_id: string;
  status: string;
  git_sha: string;
  git_ref: string;
  created_at: string;
};

type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  project: string;
  projectId: string;
  deploymentId: string;
  source: "build" | "runtime" | "edge" | "static";
};

function generateSyntheticLogs(
  projects: Project[],
  deployments: Record<string, Deployment[]>
): LogEntry[] {
  const logs: LogEntry[] = [];
  const messages = {
    info: [
      "Request handled successfully",
      "Cache HIT for /api/data",
      "SSR rendered in 45ms",
      "Static page served from CDN",
      "Edge function executed in 3ms",
      "Middleware processed request",
      "Database query completed in 12ms",
      "API route /api/users responded 200",
      "ISR revalidation triggered",
      "Image optimized and cached",
    ],
    warn: [
      "Slow database query: 2.3s",
      "Rate limit approaching for /api/auth",
      "Memory usage at 85%",
      "Deprecated API called: /api/v1/legacy",
      "Large payload detected: 4.2MB",
    ],
    error: [
      "TypeError: Cannot read property 'id' of undefined",
      "ECONNREFUSED: Database connection failed",
      "504 Gateway Timeout: upstream API",
      "OOM: Function exceeded 1024MB limit",
      "Unhandled rejection in /api/webhook",
    ],
    debug: [
      "Cache MISS for /api/products",
      "Resolving DNS for api.stripe.com",
      "WebSocket connection established",
      "JWT token validated",
    ],
  };
  const sources: LogEntry["source"][] = ["build", "runtime", "edge", "static"];

  const now = Date.now();
  for (let i = 0; i < 100; i++) {
    const project = projects[Math.floor(Math.random() * projects.length)];
    if (!project) continue;
    const projDeploys = deployments[project.id] || [];
    const deploy = projDeploys[0];
    const level = (
      Math.random() < 0.7
        ? "info"
        : Math.random() < 0.85
          ? "warn"
          : Math.random() < 0.95
            ? "error"
            : "debug"
    ) as LogEntry["level"];
    const msgs = messages[level];
    logs.push({
      timestamp: new Date(
        now - Math.floor(Math.random() * 3600000)
      ).toISOString(),
      level,
      message: msgs[Math.floor(Math.random() * msgs.length)],
      project: project.slug,
      projectId: project.id,
      deploymentId: deploy?.id || "",
      source: sources[Math.floor(Math.random() * sources.length)],
    });
  }
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function LogLevelIcon({ level }: { level: LogEntry["level"] }) {
  switch (level) {
    case "info":
      return <CheckCircle2 className="h-3.5 w-3.5 text-[#888]" />;
    case "warn":
      return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "debug":
      return <Clock className="h-3.5 w-3.5 text-blue-400" />;
  }
}

export default function LogsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

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

        const deployMap: Record<string, Deployment[]> = {};
        await Promise.all(
          ps.slice(0, 8).map(async (p) => {
            try {
              const ds = (await apiFetch(
                `/api/projects/${p.id}/deployments`
              )) as Deployment[];
              deployMap[p.id] = ds;
            } catch {
              // ignore
            }
          })
        );

        setLogs(generateSyntheticLogs(ps, deployMap));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Simulate streaming
  useEffect(() => {
    if (!streaming || projects.length === 0) return;
    const interval = setInterval(() => {
      const project = projects[Math.floor(Math.random() * projects.length)];
      const messages = [
        "Request processed: GET /api/data → 200 (23ms)",
        "Cache HIT: /static/bundle.js",
        "Edge function: /api/geo → 200 (4ms)",
        "SSR: /dashboard rendered in 67ms",
      ];
      const newLog: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        message: messages[Math.floor(Math.random() * messages.length)],
        project: project.slug,
        projectId: project.id,
        deploymentId: "",
        source: "runtime",
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 199)]);
    }, 2500);
    return () => clearInterval(interval);
  }, [streaming, projects]);

  const filtered = useMemo(() => {
    let result = logs;
    if (levelFilter !== "all") {
      result = result.filter((l) => l.level === levelFilter);
    }
    if (projectFilter !== "all") {
      result = result.filter((l) => l.projectId === projectFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.project.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, levelFilter, projectFilter, sourceFilter, search]);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Logs
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Real-time logs across all your projects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 border-[#333] bg-transparent",
              streaming
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-[#888] hover:text-white"
            )}
            onClick={() => setStreaming(!streaming)}
          >
            {streaming ? (
              <>
                <Pause className="h-3 w-3" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Resume
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[#333] bg-transparent text-[#888] hover:text-white"
            onClick={() => setLogs([])}
          >
            <RefreshCw className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-[#666]">
        <span>{filtered.length} log entries</span>
        <span className="text-[#333]">·</span>
        {errorCount > 0 && (
          <>
            <span className="text-red-400">{errorCount} errors</span>
            <span className="text-[#333]">·</span>
          </>
        )}
        {warnCount > 0 && (
          <>
            <span className="text-yellow-400">{warnCount} warnings</span>
            <span className="text-[#333]">·</span>
          </>
        )}
        <span className="flex items-center gap-1">
          {streaming && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
          {streaming ? "Live" : "Paused"}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="h-9 border-[#333] bg-[#0a0a0a] pl-9 text-xs text-white placeholder:text-[#555]"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-9 w-[120px] border-[#333] bg-[#0a0a0a] text-xs text-white">
            <Filter className="mr-1 h-3 w-3 text-[#666]" />
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-9 w-[160px] border-[#333] bg-[#0a0a0a] text-xs text-white">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-9 w-[120px] border-[#333] bg-[#0a0a0a] text-xs text-white">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="build">Build</SelectItem>
            <SelectItem value="runtime">Runtime</SelectItem>
            <SelectItem value="edge">Edge</SelectItem>
            <SelectItem value="static">Static</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex h-8 animate-pulse items-center rounded bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-16 text-center">
          <ArrowDown className="mb-3 h-6 w-6 text-[#555]" />
          <p className="text-sm text-[#888]">No log entries found.</p>
          <p className="mt-1 text-xs text-[#555]">
            {search || levelFilter !== "all"
              ? "Try adjusting your filters."
              : "Logs will appear here as requests are processed."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#333]">
          <div className="max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-[#1a1a1a]">
              {filtered.map((log, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-3 px-4 py-2 font-mono text-xs transition-colors hover:bg-[#0a0a0a]"
                >
                  <LogLevelIcon level={log.level} />
                  <span className="w-[72px] shrink-0 text-[#555]">
                    {new Date(log.timestamp).toLocaleTimeString("en", {
                      hour12: false,
                    })}
                  </span>
                  <Link
                    href={`/projects/${log.projectId}`}
                    className="w-[100px] shrink-0 truncate text-[#0070f3] hover:underline"
                  >
                    {log.project}
                  </Link>
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 border-[#333] px-1.5 text-[10px] text-[#666]"
                  >
                    {log.source}
                  </Badge>
                  <span
                    className={cn(
                      "flex-1",
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "warn"
                          ? "text-yellow-400"
                          : "text-[#ededed]"
                    )}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
