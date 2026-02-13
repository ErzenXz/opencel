"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Github, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID, setStoredOrgID } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  PROJECT_TEMPLATES,
  getProjectTemplate,
  type ProjectTemplate,
} from "@/lib/project-templates";

type Org = { id: string; name: string; slug: string; role: string };
type Repo = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  html_url: string;
};

export default function ImportPage() {
  const router = useRouter();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgID, setOrgID] = useState("");

  const [ghMe, setGhMe] = useState<{ connected: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [repoFullName, setRepoFullName] = useState("");
  const [slug, setSlug] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [buildPreset, setBuildPreset] = useState("");
  const [templateID, setTemplateID] =
    useState<ProjectTemplate["id"]>("web-service");

  const canImport = useMemo(
    () => !!orgID && !!repoFullName && !!slug,
    [orgID, repoFullName, slug]
  );
  const selectedTemplate = getProjectTemplate(templateID);

  useEffect(() => {
    (async () => {
      try {
        const os = (await apiFetch("/api/orgs")) as Org[];
        setOrgs(os);
        const stored = getStoredOrgID();
        const pick =
          os.find((o) => o.id === stored)?.id || os[0]?.id || "";
        setOrgID(pick);
        if (pick) setStoredOrgID(pick);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
      try {
        const me = (await apiFetch("/api/github/me")) as {
          connected: boolean;
        };
        setGhMe(me);
      } catch {
        setGhMe({ connected: false });
      }
    })();
  }, []);

  async function loadRepos(q: string) {
    setLoadingRepos(true);
    try {
      const res = (await apiFetch(
        `/api/github/repos?query=${encodeURIComponent(q)}&page=1&per_page=30`
      )) as { repos?: Repo[] };
      setRepos(res.repos || []);
    } catch (e: any) {
      toast.error(String(e?.message || e));
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    if (!ghMe?.connected) return;
    loadRepos(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghMe?.connected]);

  async function onSelectRepo(r: Repo) {
    setRepoFullName(r.full_name);
    const repoName = r.full_name.split("/")[1] || r.full_name;
    const s = repoName
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]+/g, "-")
      .replaceAll(/(^-+)|(-+$)/g, "");
    setSlug(s.slice(0, 32) || "my-app");
  }

  function applyTemplate(id: ProjectTemplate["id"]) {
    const t = getProjectTemplate(id);
    setTemplateID(id);
    if (!repoFullName || repoFullName.includes("owner/"))
      setRepoFullName(t.suggestedRepo);
    if (!buildPreset) setBuildPreset(t.suggestedBuildPreset);
    if (!rootDir) setRootDir(t.suggestedRootDir);
  }

  async function importProject() {
    if (!canImport) return;
    try {
      const res = (await apiFetch(`/api/orgs/${orgID}/projects/import`, {
        method: "POST",
        body: JSON.stringify({
          repo_full_name: repoFullName,
          slug,
          root_dir: rootDir,
          build_preset: buildPreset,
        }),
      })) as { project: { id: string } };
      toast.success("Project imported");
      router.replace(`/projects/${res.project.id}`);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Import Project
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Import a Git repository to deploy it.
        </p>
      </div>

      {/* Template Selection */}
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#666]">
          Framework Preset
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECT_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const active = templateID === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                  active
                    ? "border-white bg-[#111] text-white"
                    : "border-[#333] bg-[#0a0a0a] text-[#888] hover:border-[#555] hover:text-[#ededed]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{template.label}</div>
                </div>
                {active && (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Repository Selection */}
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#666]">
            Import Git Repository
          </h2>
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a]">
            {/* Org selector */}
            <div className="border-b border-[#333] px-4 py-3">
              <Select
                value={orgID}
                onValueChange={(v) => {
                  setOrgID(v);
                  setStoredOrgID(v);
                }}
              >
                <SelectTrigger className="border-[#333] bg-black text-white">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GitHub connect or repo list */}
            <div className="p-4">
              {!ghMe?.connected ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Github className="mb-3 h-8 w-8 text-[#555]" />
                  <p className="mb-4 text-sm text-[#888]">
                    Connect your GitHub account to browse repositories.
                  </p>
                  <Button asChild className="gap-2">
                    <a href="/api/auth/github/start?return_to=/import">
                      <Github className="h-4 w-4" />
                      Connect GitHub
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search..."
                        className="border-[#333] bg-black pl-9 text-white placeholder:text-[#555]"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                      onClick={() => loadRepos(query)}
                      disabled={loadingRepos}
                    >
                      {loadingRepos ? "..." : "Search"}
                    </Button>
                  </div>
                  <div className="max-h-[360px] overflow-auto rounded-md border border-[#333]">
                    {repos.length ? (
                      <div className="divide-y divide-[#222]">
                        {repos.slice(0, 18).map((r) => (
                          <button
                            key={r.id}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#111]",
                              repoFullName === r.full_name && "bg-[#111]"
                            )}
                            onClick={() => onSelectRepo(r)}
                            type="button"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-white">
                                {r.full_name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#666]">
                                <span>{r.private ? "Private" : "Public"}</span>
                                <span>·</span>
                                <span>{r.default_branch}</span>
                              </div>
                            </div>
                            {repoFullName === r.full_name ? (
                              <Check className="h-4 w-4 shrink-0 text-white" />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 border-[#333] bg-transparent text-xs text-[#ededed] hover:bg-[#1a1a1a]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRepo(r);
                                }}
                              >
                                Import
                              </Button>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-[#666]">
                        {loadingRepos
                          ? "Loading repositories..."
                          : "No repositories found."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual repo input */}
              <div className="mt-4">
                <label className="mb-1.5 block text-xs text-[#666]">
                  Or enter repository manually
                </label>
                <Input
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  placeholder="owner/repo"
                  className="border-[#333] bg-black text-white placeholder:text-[#555]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Configure & Deploy */}
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#666]">
            Configure Project
          </h2>
          <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-[#888]">Project Name</label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-app"
                  className="border-[#333] bg-black text-white placeholder:text-[#555]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#888]">
                  Root Directory{" "}
                  <span className="text-[#555]">(optional)</span>
                </label>
                <Input
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  placeholder="./"
                  className="border-[#333] bg-black text-white placeholder:text-[#555]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#888]">
                  Build Preset{" "}
                  <span className="text-[#555]">(optional)</span>
                </label>
                <Input
                  value={buildPreset}
                  onChange={(e) => setBuildPreset(e.target.value)}
                  placeholder="auto"
                  className="border-[#333] bg-black text-white placeholder:text-[#555]"
                />
              </div>

              {/* Template hints */}
              <div className="rounded-md border border-[#333] bg-black px-4 py-3">
                <div className="mb-2 text-xs font-medium text-[#888]">
                  Defaults for {selectedTemplate.label}
                </div>
                <ul className="space-y-1 text-xs text-[#666]">
                  {selectedTemplate.hints.map((hint) => (
                    <li key={hint} className="flex items-start gap-2">
                      <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-[#555]" />
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={importProject}
                  disabled={!canImport}
                >
                  Deploy
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                >
                  <Link href="/admin">Configure GitHub App</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
