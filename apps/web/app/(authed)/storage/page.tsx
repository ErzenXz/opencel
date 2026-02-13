"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Loader2,
  MoreVertical,
  Plus,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ───
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

// ─── Persistence (localStorage demo) ───
const STORAGE_KEY = "opencel_stores";

function getStores(): StoreInstance[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveStores(stores: StoreInstance[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

// ─── Constants ───
const STORE_TYPES: {
  id: StoreType;
  label: string;
  description: string;
  icon: typeof Database;
  color: string;
  bgColor: string;
}[] = [
  {
    id: "postgres",
    label: "Postgres",
    description: "Serverless SQL database powered by Neon",
    icon: Database,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "redis",
    label: "Redis",
    description: "Durable Redis-compatible key-value store",
    icon: Zap,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    id: "kv",
    label: "KV",
    description: "Global, low-latency key-value data store",
    icon: Server,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "blob",
    label: "Blob",
    description: "File storage for images, videos, and assets",
    icon: HardDrive,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
];

const REGIONS = [
  { id: "iad1", label: "Washington, D.C. (iad1)" },
  { id: "sfo1", label: "San Francisco (sfo1)" },
  { id: "cdg1", label: "Paris (cdg1)" },
  { id: "hnd1", label: "Tokyo (hnd1)" },
  { id: "sin1", label: "Singapore (sin1)" },
  { id: "syd1", label: "Sydney (syd1)" },
];

const PLANS: Record<StoreType, { id: string; label: string; limit: string }[]> = {
  postgres: [
    { id: "hobby", label: "Hobby", limit: "256 MB · 1 compute" },
    { id: "pro", label: "Pro", limit: "10 GB · 4 compute" },
    { id: "enterprise", label: "Enterprise", limit: "Unlimited" },
  ],
  redis: [
    { id: "hobby", label: "Hobby", limit: "256 MB · 30 conn" },
    { id: "pro", label: "Pro", limit: "3 GB · 1000 conn" },
    { id: "enterprise", label: "Enterprise", limit: "Unlimited" },
  ],
  kv: [
    { id: "hobby", label: "Hobby", limit: "1 GB · 150k req/day" },
    { id: "pro", label: "Pro", limit: "5 GB · Unlimited" },
  ],
  blob: [
    { id: "hobby", label: "Hobby", limit: "1 GB storage" },
    { id: "pro", label: "Pro", limit: "100 GB storage" },
    { id: "enterprise", label: "Enterprise", limit: "Unlimited" },
  ],
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

function StatusIndicator({ status }: { status: StoreInstance["status"] }) {
  return (
    <span className="relative flex h-2 w-2">
      {status === "provisioning" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-500 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          status === "available" && "bg-emerald-500",
          status === "provisioning" && "bg-yellow-500",
          status === "error" && "bg-red-500",
          status === "suspended" && "bg-[#555]"
        )}
      />
    </span>
  );
}

export default function StoragePage() {
  const [stores, setStores] = useState<StoreInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<StoreType | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("iad1");
  const [plan, setPlan] = useState("hobby");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<StoreType | "all">("all");

  useEffect(() => {
    const existing = getStores();
    setStores(existing);
    setLoading(false);
  }, []);

  function onCreate() {
    if (!selectedType || !name) return;
    setCreating(true);

    const storeType = STORE_TYPES.find((t) => t.id === selectedType)!;
    const newStore: StoreInstance = {
      id: `store_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      type: selectedType,
      status: "provisioning",
      region,
      plan,
      createdAt: new Date().toISOString(),
      size: "0 B",
      connections: 0,
      keys: 0,
    };

    const updated = [newStore, ...stores];
    setStores(updated);
    saveStores(updated);
    setCreateOpen(false);
    setSelectedType(null);
    setName("");
    setRegion("iad1");
    setPlan("hobby");
    setCreating(false);

    toast.success(`${storeType.label} "${newStore.name}" is provisioning...`);

    // Simulate provisioning
    setTimeout(() => {
      setStores((prev) => {
        const next = prev.map((s) =>
          s.id === newStore.id ? { ...s, status: "available" as const } : s
        );
        saveStores(next);
        return next;
      });
      toast.success(`${storeType.label} "${newStore.name}" is ready!`);
    }, 3000);
  }

  function onDelete(storeId: string) {
    const updated = stores.filter((s) => s.id !== storeId);
    setStores(updated);
    saveStores(updated);
    toast.success("Store deleted");
  }

  const filtered =
    filter === "all" ? stores : stores.filter((s) => s.type === filter);

  const storesByType = STORE_TYPES.map((t) => ({
    ...t,
    count: stores.filter((s) => s.type === t.id).length,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Storage
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Create and manage databases, caches, and file storage.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Store
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#333] bg-[#0a0a0a] sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-white">Create Store</DialogTitle>
              <DialogDescription className="text-[#888]">
                {selectedType
                  ? `Configure your new ${STORE_TYPES.find((t) => t.id === selectedType)?.label} instance.`
                  : "Choose a storage type to get started."}
              </DialogDescription>
            </DialogHeader>

            {!selectedType ? (
              /* Type Selection */
              <div className="grid gap-3 sm:grid-cols-2">
                {STORE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedType(type.id);
                      setPlan(PLANS[type.id][0].id);
                    }}
                    className="group flex items-start gap-3 rounded-lg border border-[#333] bg-[#111] p-4 text-left transition-colors hover:border-[#555] hover:bg-[#1a1a1a]"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        type.bgColor
                      )}
                    >
                      <type.icon className={cn("h-5 w-5", type.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {type.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[#666]">
                        {type.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Configuration */
              <div className="space-y-4">
                {/* Selected type badge */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedType(null)}
                    className="text-xs text-[#0070f3] hover:underline"
                  >
                    ← Change type
                  </button>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-[#333]",
                      STORE_TYPES.find((t) => t.id === selectedType)?.color
                    )}
                  >
                    {STORE_TYPES.find((t) => t.id === selectedType)?.label}
                  </Badge>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">Database Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`my-${selectedType}-db`}
                    className="border-[#333] bg-black text-white placeholder:text-[#555]"
                  />
                </div>

                {/* Region */}
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">Region</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="border-[#333] bg-black text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan */}
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">Plan</label>
                  <div className="grid gap-2">
                    {PLANS[selectedType].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPlan(p.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                          plan === p.id
                            ? "border-white bg-[#1a1a1a]"
                            : "border-[#333] bg-[#0a0a0a] hover:border-[#555]"
                        )}
                      >
                        <div>
                          <span className="text-sm font-medium text-white">
                            {p.label}
                          </span>
                          <p className="text-xs text-[#666]">{p.limit}</p>
                        </div>
                        {plan === p.id && (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedType && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    setSelectedType(null);
                  }}
                  className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={onCreate}
                  disabled={!name || creating}
                  className="gap-2"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Type overview cards */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
        {storesByType.map((type) => (
          <button
            key={type.id}
            onClick={() =>
              setFilter(filter === type.id ? "all" : type.id)
            }
            className={cn(
              "flex items-center gap-3 bg-[#0a0a0a] p-4 text-left transition-colors hover:bg-[#111]",
              filter === type.id && "bg-[#111]"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                type.bgColor
              )}
            >
              <type.icon className={cn("h-4 w-4", type.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {type.label}
                </span>
                {filter === type.id && (
                  <span className="h-1 w-1 rounded-full bg-white" />
                )}
              </div>
              <p className="text-xs text-[#666]">
                {type.count} instance{type.count !== 1 ? "s" : ""}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Store instances list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[80px] animate-pulse rounded-lg border border-[#333] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#333] bg-[#111]">
            <Database className="h-6 w-6 text-[#555]" />
          </div>
          <p className="text-sm text-[#888]">
            {filter !== "all"
              ? `No ${STORE_TYPES.find((t) => t.id === filter)?.label} instances yet.`
              : "No stores created yet."}
          </p>
          <p className="mt-1 text-xs text-[#555]">
            Create a database, cache, or blob store to get started.
          </p>
          <Button
            size="sm"
            className="mt-4 gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Store
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((store) => {
            const typeDef = STORE_TYPES.find((t) => t.id === store.type)!;
            const Icon = typeDef.icon;
            return (
              <div
                key={store.id}
                className="group rounded-lg border border-[#333] bg-[#0a0a0a] transition-colors hover:border-[#555]"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      typeDef.bgColor
                    )}
                  >
                    <Icon className={cn("h-5 w-5", typeDef.color)} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/storage/${store.id}`}
                        className="text-sm font-medium text-white hover:underline"
                      >
                        {store.name}
                      </Link>
                      <StatusIndicator status={store.status} />
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-[#333] text-[10px]",
                          store.status === "available" &&
                            "border-emerald-800/50 text-emerald-400",
                          store.status === "provisioning" &&
                            "border-yellow-800/50 text-yellow-400",
                          store.status === "error" &&
                            "border-red-800/50 text-red-400"
                        )}
                      >
                        {store.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-[#666]">
                      <span>{typeDef.label}</span>
                      <span className="text-[#333]">·</span>
                      <span>
                        {REGIONS.find((r) => r.id === store.region)?.label ||
                          store.region}
                      </span>
                      <span className="text-[#333]">·</span>
                      <span className="capitalize">{store.plan}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden items-center gap-6 md:flex">
                    {(store.type === "postgres" || store.type === "redis") && (
                      <div className="text-right">
                        <p className="text-xs text-[#666]">Connections</p>
                        <p className="font-mono text-sm text-[#ededed]">
                          {store.connections ?? 0}
                        </p>
                      </div>
                    )}
                    {(store.type === "kv" || store.type === "redis") && (
                      <div className="text-right">
                        <p className="text-xs text-[#666]">Keys</p>
                        <p className="font-mono text-sm text-[#ededed]">
                          {store.keys ?? 0}
                        </p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-[#666]">Created</p>
                      <p className="text-xs text-[#888]">
                        {timeAgo(store.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1.5 text-[#666] opacity-0 transition-all hover:bg-[#1a1a1a] hover:text-white group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem asChild>
                        <Link href={`/storage/${store.id}`} className="gap-2">
                          <ArrowRight className="h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => {
                          const connStr =
                            store.type === "postgres"
                              ? `postgresql://user:pass@${store.region}.db.opencel.app:5432/${store.name}`
                              : store.type === "redis"
                                ? `redis://default:pass@${store.region}.redis.opencel.app:6379`
                                : `opencel://${store.type}/${store.name}`;
                          navigator.clipboard.writeText(connStr);
                          toast.success("Connection string copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Connection URL
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-red-400 focus:text-red-400"
                        onClick={() => onDelete(store.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick connect info */}
      {stores.length > 0 && (
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0070f3]" />
            <div>
              <p className="text-sm font-medium text-white">
                Connect to your stores
              </p>
              <p className="mt-1 text-xs text-[#888]">
                Environment variables are automatically set when you link a
                store to a project. You can also find connection strings in
                each store&apos;s detail page.
              </p>
              <div className="mt-3 rounded-md bg-[#111] p-3">
                <code className="text-xs text-[#ededed]">
                  <span className="text-[#0070f3]">import</span> {"{"} sql{" "}
                  {"}"} <span className="text-[#0070f3]">from</span>{" "}
                  <span className="text-emerald-400">
                    &apos;@vercel/postgres&apos;
                  </span>
                  ;
                  <br />
                  <br />
                  <span className="text-[#888]">
                    {"// Automatically uses POSTGRES_URL env var"}
                  </span>
                  <br />
                  <span className="text-[#0070f3]">const</span> result ={" "}
                  <span className="text-[#0070f3]">await</span>{" "}
                  sql<span className="text-emerald-400">{"`SELECT * FROM users`"}</span>;
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
