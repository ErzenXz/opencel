"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ChevronRight,
  Copy,
  Database,
  Globe,
  HardDrive,
  Link2,
  Play,
  Server,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type StoreType = "postgres" | "redis" | "kv" | "blob";

type StoreInstance = {
  id: string;
  name: string;
  type: StoreType;
  status: "provisioning" | "available" | "error" | "suspended";
  region: string;
  plan: string;
  createdAt: string;
  size?: string;
  connections?: number;
  keys?: number;
};

const STORAGE_KEY = "opencel_stores";

function getStores(): StoreInstance[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

const TYPE_META: Record<
  StoreType,
  { label: string; icon: typeof Database; color: string; bgColor: string }
> = {
  postgres: {
    label: "Postgres",
    icon: Database,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  redis: {
    label: "Redis",
    icon: Zap,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  kv: {
    label: "KV",
    icon: Server,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  blob: {
    label: "Blob",
    icon: HardDrive,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
};

function StatusDot({ status }: { status: StoreInstance["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 rounded-full",
        status === "available" && "bg-emerald-500",
        status === "provisioning" && "bg-yellow-500",
        status === "error" && "bg-red-500",
        status === "suspended" && "bg-[#555]"
      )}
    />
  );
}

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const storeID = params?.id;
  const [store, setStore] = useState<StoreInstance | null>(null);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);

  useEffect(() => {
    const all = getStores();
    const found = all.find((s) => s.id === storeID) || null;
    setStore(found);
  }, [storeID]);

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Database className="mb-3 h-8 w-8 text-[#555]" />
        <p className="text-sm text-[#888]">Store not found.</p>
        <Button asChild size="sm" variant="outline" className="mt-3 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]">
          <Link href="/storage">Back to Storage</Link>
        </Button>
      </div>
    );
  }

  const meta = TYPE_META[store.type];
  const Icon = meta.icon;

  const connString =
    store.type === "postgres"
      ? `postgresql://neondb_owner:••••••••@ep-${store.region}.${store.region}.aws.neon.tech/${store.name}?sslmode=require`
      : store.type === "redis"
        ? `rediss://default:••••••••@${store.region}.redis.opencel.app:6379`
        : store.type === "kv"
          ? `https://kv.opencel.app/api/v1/${store.id}`
          : `https://blob.opencel.app/${store.id}`;

  const envVars =
    store.type === "postgres"
      ? [
          { key: "POSTGRES_URL", value: connString },
          { key: "POSTGRES_URL_NON_POOLING", value: connString.replace("?sslmode=require", "?sslmode=require&pgbouncer=false") },
          { key: "POSTGRES_PRISMA_URL", value: connString + "&connect_timeout=15" },
          { key: "POSTGRES_USER", value: "neondb_owner" },
          { key: "POSTGRES_HOST", value: `ep-${store.region}.${store.region}.aws.neon.tech` },
          { key: "POSTGRES_PASSWORD", value: "••••••••" },
          { key: "POSTGRES_DATABASE", value: store.name },
        ]
      : store.type === "redis"
        ? [
            { key: "REDIS_URL", value: connString },
            { key: "KV_REST_API_URL", value: `https://${store.region}.redis.opencel.app` },
            { key: "KV_REST_API_TOKEN", value: "••••••••" },
          ]
        : store.type === "kv"
          ? [
              { key: "KV_REST_API_URL", value: `https://kv.opencel.app/api/v1` },
              { key: "KV_REST_API_TOKEN", value: "••••••••" },
            ]
          : [
              { key: "BLOB_READ_WRITE_TOKEN", value: "••••••••" },
            ];

  function runQuery() {
    if (!query.trim()) return;
    setQueryRunning(true);
    setQueryResult(null);
    setTimeout(() => {
      if (store?.type === "postgres") {
        if (query.toLowerCase().startsWith("select")) {
          setQueryResult(
            `┌─────────┬──────────────┬─────────────────────┐\n│  id     │  name        │  created_at         │\n├─────────┼──────────────┼─────────────────────┤\n│  1      │  example     │  2024-01-15 10:30   │\n│  2      │  demo        │  2024-01-16 14:22   │\n└─────────┴──────────────┴─────────────────────┘\n\n2 rows returned (12ms)`
          );
        } else {
          setQueryResult("Query OK, 0 rows affected (8ms)");
        }
      } else if (store?.type === "redis") {
        setQueryResult('"OK"');
      } else {
        setQueryResult("Operation completed successfully");
      }
      setQueryRunning(false);
    }, 800);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/storage" className="text-[#888] hover:text-white">
                Storage
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white">
              {store.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              meta.bgColor
            )}
          >
            <Icon className={cn("h-6 w-6", meta.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {store.name}
              </h1>
              <StatusDot status={store.status} />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-[#888]">
              <span>{meta.label}</span>
              <span className="text-[#333]">·</span>
              <span className="capitalize">{store.plan}</span>
              <span className="text-[#333]">·</span>
              <span>{store.region}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-red-800/50 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => {
            const all = getStores().filter((s) => s.id !== store.id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
            toast.success("Store deleted");
            window.location.href = "/storage";
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Store
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="border-b border-[#333] bg-transparent p-0">
          {["overview", "query", "env", "settings"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm capitalize text-[#888] data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              {tab === "env" ? "Environment" : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats */}
          <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-[#0a0a0a] p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                Status
              </span>
              <div className="mt-2 flex items-center gap-2">
                <StatusDot status={store.status} />
                <span className="text-sm capitalize text-white">
                  {store.status}
                </span>
              </div>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                Storage Used
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {store.size || "0 B"}
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                {store.type === "blob" ? "Files" : "Connections"}
              </span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                {store.connections ?? 0}
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
                Region
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-[#666]" />
                <span className="text-sm text-white">{store.region}</span>
              </div>
            </div>
          </div>

          {/* Connection string */}
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#666]" />
              <span className="text-sm font-medium text-white">
                Connection String
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-[#333] bg-black px-3 py-2.5 font-mono text-xs text-[#ededed]">
                {connString}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-[#333] bg-transparent hover:bg-[#111]"
                onClick={() => {
                  navigator.clipboard.writeText(connString);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Usage chart placeholder */}
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#666]" />
              <span className="text-sm font-medium text-white">
                Usage (last 24h)
              </span>
            </div>
            <div className="flex h-32 items-end gap-1">
              {Array.from({ length: 24 }, (_, i) => {
                const h = Math.random() * 80 + 10;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-[#0070f3]/40 transition-colors hover:bg-[#0070f3]"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[#555]">
              <span>24h ago</span>
              <span>Now</span>
            </div>
          </div>
        </TabsContent>

        {/* Query Console */}
        <TabsContent value="query" className="space-y-4">
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a]">
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#666]" />
                <span className="text-xs font-medium text-[#888]">
                  {store.type === "postgres"
                    ? "SQL Console"
                    : store.type === "redis"
                      ? "Redis CLI"
                      : "Query Console"}
                </span>
              </div>
              <Button
                size="sm"
                className="h-7 gap-1.5 px-3 text-xs"
                onClick={runQuery}
                disabled={queryRunning || !query.trim()}
              >
                <Play className="h-3 w-3" />
                Run
              </Button>
            </div>
            <div className="p-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  store.type === "postgres"
                    ? "SELECT * FROM users LIMIT 10;"
                    : store.type === "redis"
                      ? "GET my-key"
                      : "Enter query..."
                }
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
                onKeyDown={(e) => e.key === "Enter" && runQuery()}
              />
            </div>
            {queryResult !== null && (
              <div className="border-t border-[#222] bg-black p-4">
                <pre className="overflow-x-auto font-mono text-xs leading-5 text-[#ededed]">
                  {queryResult}
                </pre>
              </div>
            )}
          </div>

          {/* Quick queries */}
          {store.type === "postgres" && (
            <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
              <p className="mb-3 text-xs font-medium text-[#888]">
                Quick Queries
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
                  "SELECT COUNT(*) FROM information_schema.tables;",
                  "SELECT version();",
                  "\\dt",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    className="rounded-md border border-[#333] bg-[#111] px-2.5 py-1.5 font-mono text-[11px] text-[#888] transition-colors hover:border-[#555] hover:text-white"
                  >
                    {q.length > 40 ? q.slice(0, 40) + "..." : q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {store.type === "redis" && (
            <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
              <p className="mb-3 text-xs font-medium text-[#888]">
                Quick Commands
              </p>
              <div className="flex flex-wrap gap-2">
                {["PING", "DBSIZE", "INFO", "KEYS *", "SET foo bar", "GET foo"].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => setQuery(q)}
                      className="rounded-md border border-[#333] bg-[#111] px-2.5 py-1.5 font-mono text-[11px] text-[#888] transition-colors hover:border-[#555] hover:text-white"
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Environment Variables */}
        <TabsContent value="env" className="space-y-4">
          <p className="text-sm text-[#888]">
            These environment variables are automatically available when this
            store is linked to a project.
          </p>
          <div className="overflow-hidden rounded-lg border border-[#333]">
            <div className="hidden border-b border-[#333] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[200px_1fr_60px]">
              <div>Variable</div>
              <div>Value</div>
              <div />
            </div>
            <div className="divide-y divide-[#222]">
              {envVars.map((v) => (
                <div
                  key={v.key}
                  className="grid items-center gap-3 px-4 py-3 md:grid-cols-[200px_1fr_60px]"
                >
                  <span className="font-mono text-xs font-medium text-[#ededed]">
                    {v.key}
                  </span>
                  <code className="truncate font-mono text-xs text-[#888]">
                    {v.value}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[#666] hover:text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(v.value);
                      toast.success(`${v.key} copied`);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-6">
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-medium text-white">General</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-[#888]">Store ID</label>
                <p className="mt-1 font-mono text-xs text-[#ededed]">
                  {store.id}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#888]">Type</label>
                <p className="mt-1 text-sm capitalize text-[#ededed]">
                  {meta.label}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#888]">Plan</label>
                <p className="mt-1 text-sm capitalize text-[#ededed]">
                  {store.plan}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#888]">Region</label>
                <p className="mt-1 text-sm text-[#ededed]">{store.region}</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-lg border border-red-900/50 bg-[#0a0a0a] p-5">
            <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
            <p className="mt-1 text-xs text-[#888]">
              Permanently delete this store and all its data. This action
              cannot be undone.
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2 border-red-800/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => {
                const all = getStores().filter((s) => s.id !== store.id);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
                toast.success("Store deleted");
                window.location.href = "/storage";
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Store
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
