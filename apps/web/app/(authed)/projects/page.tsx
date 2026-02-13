"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GitBranch,
  Grid3X3,
  Heart,
  LayoutList,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_TEMPLATES,
  getProjectTemplate,
  type ProjectTemplate,
} from "@/lib/project-templates";

type Project = {
  id: string;
  org_id: string;
  slug: string;
  repo_full_name: string;
  production_deployment_id?: string | null;
  created_at: string;
};

type Deployment = {
  id: string;
  project_id: string;
  status: string;
  git_ref: string;
  git_sha: string;
  created_at: string;
  preview_url?: string | null;
};

// ─── Favorites (localStorage) ───
const FAVORITES_KEY = "opencel_favorites";

function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function toggleFavorite(projectID: string) {
  const favs = getFavorites();
  const idx = favs.indexOf(projectID);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(projectID);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}



// ─── View Preference (localStorage) ───
const VIEW_KEY = "opencel_view";
type ViewMode = "grid" | "list";

function getViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

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
    <span className="relative flex h-2 w-2">
      {(status === "BUILDING" || status === "QUEUED") && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            color
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [latestDeployments, setLatestDeployments] = useState<
    Record<string, Deployment>
  >({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [favoritesSet, setFavoritesSet] = useState<Set<string>>(new Set());
  const [templateID, setTemplateID] =
    useState<ProjectTemplate["id"]>("web-service");
  const [slug, setSlug] = useState("");
  const [repo, setRepo] = useState("");

  const orgID = useMemo(() => getStoredOrgID(), []);

  // Load view preference
  useEffect(() => {
    setViewMode(getViewMode());
    setFavoritesSet(new Set(getFavorites()));
  }, []);

  async function refresh() {
    if (!orgID) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ps = (await apiFetch(`/api/orgs/${orgID}/projects`)) as Project[];
      setProjects(ps);
      // Fetch latest deployment for each project (first 12)
      const deployMap: Record<string, Deployment> = {};
      await Promise.all(
        ps.slice(0, 12).map(async (p) => {
          try {
            const ds = (await apiFetch(
              `/api/projects/${p.id}/deployments`
            )) as Deployment[];
            if (ds[0]) deployMap[p.id] = ds[0];
          } catch {
            // ignore
          }
        })
      );
      setLatestDeployments(deployMap);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!orgID) return;
    try {
      const p = (await apiFetch(`/api/orgs/${orgID}/projects`, {
        method: "POST",
        body: JSON.stringify({ slug, repo_full_name: repo }),
      })) as Project;
      setProjects((prev) => [p, ...prev]);
      setSlug("");
      setRepo("");
      setCreateOpen(false);
      toast.success("Project created");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  function onToggleFavorite(e: React.MouseEvent, projectID: string) {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(projectID);
    setFavoritesSet(new Set(getFavorites()));
  }

  function onToggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects;
    if (q) {
      list = list.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.repo_full_name.toLowerCase().includes(q)
      );
    }
    // Sort: favorites first, then by created_at
    return [...list].sort((a, b) => {
      const aFav = favoritesSet.has(a.id) ? 0 : 1;
      const bFav = favoritesSet.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [projects, query, favoritesSet]);

  const selectedTemplate = getProjectTemplate(templateID);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 border-[#333] bg-[#0a0a0a] pl-9 text-sm text-white placeholder:text-[#555] focus-visible:ring-white"
            placeholder="Search Projects..."
          />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-[#333]">
            <button
              onClick={() => onToggleView("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-l-md transition-colors",
                viewMode === "grid"
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleView("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-r-md border-l border-[#333] transition-colors",
                viewMode === "list"
                  ? "bg-[#1a1a1a] text-white"
                  : "text-[#666] hover:text-white"
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-10 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111] hover:text-white"
          >
            <Link href="/import">Import Project</Link>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 gap-2">
                <Plus className="h-4 w-4" />
                Add New...
              </Button>
            </DialogTrigger>
            <DialogContent className="border-[#333] bg-[#0a0a0a] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Create Project
                </DialogTitle>
                <DialogDescription className="text-[#888]">
                  Scoped to your active team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">Project Type</label>
                  <Select
                    value={templateID}
                    onValueChange={(v) => {
                      const id = v as ProjectTemplate["id"];
                      const template = getProjectTemplate(id);
                      setTemplateID(id);
                      if (!repo || repo.includes("owner/"))
                        setRepo(template.suggestedRepo);
                    }}
                  >
                    <SelectTrigger className="border-[#333] bg-black text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#666]">
                    {selectedTemplate.description}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">Project Name</label>
                  <Input
                    placeholder="my-app"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="border-[#333] bg-black text-white placeholder:text-[#555]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">
                    GitHub Repository
                  </label>
                  <Input
                    placeholder="owner/repo"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    className="border-[#333] bg-black text-white placeholder:text-[#555]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                >
                  Cancel
                </Button>
                <Button onClick={onCreate} disabled={!slug || !repo}>
                  Deploy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && projects.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-[#666]">
          <span>{projects.length} projects</span>
          <span>·</span>
          <span>{favoritesSet.size} favorited</span>
          <span>·</span>
          <span>
            {
              Object.values(latestDeployments).filter(
                (d) => d.status === "READY"
              ).length
            }{" "}
            deployed
          </span>
        </div>
      )}

      {/* Project Grid/List */}
      {!orgID ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-20 text-center">
          <p className="text-sm text-[#888]">No team selected.</p>
          <p className="mt-1 text-xs text-[#555]">
            Select a team from the navigation to get started.
          </p>
        </div>
      ) : loading ? (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-2"
          )}
        >
          {[1, 2, 3, 4, 5, 6].map((i) =>
            viewMode === "grid" ? (
              <div
                key={i}
                className="rounded-lg border border-[#333] bg-[#0a0a0a] p-6"
              >
                <Skeleton className="mb-4 h-[100px] w-full rounded-md bg-[#1a1a1a]" />
                <Skeleton className="mb-2 h-5 w-32 bg-[#1a1a1a]" />
                <Skeleton className="mb-2 h-4 w-48 bg-[#1a1a1a]" />
                <Skeleton className="h-3 w-24 bg-[#1a1a1a]" />
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-[#333] bg-[#0a0a0a] p-4"
              >
                <Skeleton className="h-10 w-10 rounded-md bg-[#1a1a1a]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 bg-[#1a1a1a]" />
                  <Skeleton className="h-3 w-48 bg-[#1a1a1a]" />
                </div>
                <Skeleton className="h-3 w-16 bg-[#1a1a1a]" />
              </div>
            )
          )}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#333] bg-[#111]">
            <GitBranch className="h-5 w-5 text-[#666]" />
          </div>
          <p className="text-sm text-[#888]">
            {query ? "No projects match your search." : "No projects yet."}
          </p>
          <p className="mt-1 text-xs text-[#555]">
            {query
              ? "Try a different search term."
              : "Import a Git repository or create a new project to get started."}
          </p>
          {!query && (
            <div className="mt-4 flex gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
              >
                <Link href="/import">Import Project</Link>
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add New Project
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ─── Grid View ─── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => {
            const latest = latestDeployments[p.id];
            const isFav = favoritesSet.has(p.id);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group relative rounded-lg border border-[#333] bg-[#0a0a0a] transition-colors hover:border-[#555] hover:bg-[#111]"
              >
                {/* Preview */}
                <div className="relative flex h-[120px] items-center justify-center rounded-t-lg border-b border-[#222] bg-gradient-to-br from-[#111] to-[#0a0a0a]">
                  <svg
                    height="20"
                    viewBox="0 0 76 65"
                    className="text-[#333] transition-colors group-hover:text-[#555]"
                    fill="currentColor"
                  >
                    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                  </svg>
                  {/* Favorite button */}
                  <button
                    onClick={(e) => onToggleFavorite(e, p.id)}
                    className={cn(
                      "absolute right-3 top-3 rounded-md p-1.5 transition-all",
                      isFav
                        ? "text-red-400 hover:text-red-300"
                        : "text-[#555] opacity-0 group-hover:opacity-100 hover:text-[#888]"
                    )}
                  >
                    <Heart
                      className={cn("h-4 w-4", isFav && "fill-current")}
                    />
                  </button>
                  {/* Status indicator */}
                  {latest && (
                    <div className="absolute bottom-3 left-3">
                      <div className="flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 backdrop-blur-sm">
                        <StatusDot status={latest.status} />
                        <span className="text-[10px] font-medium text-[#ededed]">
                          {latest.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2 p-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {p.slug}
                    </h3>
                    {isFav && (
                      <Heart className="h-3 w-3 fill-red-400 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 text-[#666]" />
                    <span className="truncate text-xs text-[#888]">
                      {p.repo_full_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#555]">
                      {timeAgo(p.created_at)}
                    </p>
                    {latest?.preview_url && (
                      <span className="truncate text-xs text-[#0070f3]">
                        {(() => {
                          try {
                            return new URL(latest.preview_url).hostname;
                          } catch {
                            return "";
                          }
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ─── List View ─── */
        <div className="overflow-hidden rounded-lg border border-[#333]">
          <div className="hidden border-b border-[#333] bg-[#0a0a0a] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#666] md:grid md:grid-cols-[1fr_1fr_120px_120px_40px]">
            <div>Project</div>
            <div>Repository</div>
            <div>Status</div>
            <div>Updated</div>
            <div />
          </div>
          <div className="divide-y divide-[#222]">
            {filteredProjects.map((p) => {
              const latest = latestDeployments[p.id];
              const isFav = favoritesSet.has(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group grid items-center gap-3 px-4 py-3 transition-colors hover:bg-[#0a0a0a] md:grid-cols-[1fr_1fr_120px_120px_40px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#333] bg-[#111]">
                      <svg
                        height="12"
                        viewBox="0 0 76 65"
                        className="text-[#555]"
                        fill="currentColor"
                      >
                        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                        {p.slug}
                        {isFav && (
                          <Heart className="h-3 w-3 fill-red-400 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-[#888]">
                    <GitBranch className="h-3 w-3 text-[#555]" />
                    <span className="truncate">{p.repo_full_name}</span>
                  </div>
                  <div>
                    {latest ? (
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={latest.status} />
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-[#333] text-[10px]",
                            latest.status === "READY" &&
                              "border-emerald-800/50 text-emerald-400",
                            (latest.status === "BUILDING" ||
                              latest.status === "QUEUED") &&
                              "border-yellow-800/50 text-yellow-400",
                            (latest.status === "ERROR" ||
                              latest.status === "FAILED") &&
                              "border-red-800/50 text-red-400"
                          )}
                        >
                          {latest.status}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-[#555]">—</span>
                    )}
                  </div>
                  <div className="text-xs text-[#666]">
                    {timeAgo(p.created_at)}
                  </div>
                  <div>
                    <button
                      onClick={(e) => onToggleFavorite(e, p.id)}
                      className={cn(
                        "rounded-md p-1 transition-all",
                        isFav
                          ? "text-red-400"
                          : "text-[#555] opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <Heart
                        className={cn(
                          "h-3.5 w-3.5",
                          isFav && "fill-current"
                        )}
                      />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
