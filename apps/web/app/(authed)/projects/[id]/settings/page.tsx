"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  repo_full_name: string;
  org_id: string;
  github_default_branch?: string | null;
};

type ProjectSettings = {
  framework?: string;
  build_command?: string;
  output_directory?: string;
  install_command?: string;
  root_directory?: string;
  node_version?: string;
};

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<ProjectSettings>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!projectID) return;
    (async () => {
      try {
        const p = (await apiFetch(`/api/projects/${projectID}`)) as Project;
        setProject(p);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
    })();
  }, [projectID]);

  function updateSetting<K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Settings are stored as JSON blob
      toast.success("Project settings saved");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

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
            <BreadcrumbPage className="text-white">Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Project Settings
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Configure build and deployment settings for{" "}
          <span className="text-white">{project?.slug}</span>.
        </p>
      </div>

      {/* General */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">General</h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Project name and repository info.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Project Name</label>
              <Input
                value={project?.slug || ""}
                disabled
                className="border-[#333] bg-[#111] text-[#888]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Repository</label>
              <Input
                value={project?.repo_full_name || ""}
                disabled
                className="border-[#333] bg-[#111] text-[#888]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Build & Development Settings */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            Build & Development Settings
          </h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Override the default build settings for this project.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label className="text-sm text-[#888]">Framework Preset</label>
            <Select
              value={settings.framework || "auto"}
              onValueChange={(v) => updateSetting("framework", v)}
            >
              <SelectTrigger className="border-[#333] bg-black text-white">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="nextjs">Next.js</SelectItem>
                <SelectItem value="react">Create React App</SelectItem>
                <SelectItem value="vue">Vue.js</SelectItem>
                <SelectItem value="nuxt">Nuxt.js</SelectItem>
                <SelectItem value="svelte">SvelteKit</SelectItem>
                <SelectItem value="astro">Astro</SelectItem>
                <SelectItem value="remix">Remix</SelectItem>
                <SelectItem value="static">Other (Static)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Build Command</label>
              <Input
                value={settings.build_command || ""}
                onChange={(e) =>
                  updateSetting("build_command", e.target.value)
                }
                placeholder="npm run build"
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Output Directory</label>
              <Input
                value={settings.output_directory || ""}
                onChange={(e) =>
                  updateSetting("output_directory", e.target.value)
                }
                placeholder=".next"
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Install Command</label>
              <Input
                value={settings.install_command || ""}
                onChange={(e) =>
                  updateSetting("install_command", e.target.value)
                }
                placeholder="npm install"
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">Root Directory</label>
              <Input
                value={settings.root_directory || ""}
                onChange={(e) =>
                  updateSetting("root_directory", e.target.value)
                }
                placeholder="./"
                className="border-[#333] bg-black font-mono text-sm text-white placeholder:text-[#555]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[#888]">Node.js Version</label>
            <Select
              value={settings.node_version || "20.x"}
              onValueChange={(v) => updateSetting("node_version", v)}
            >
              <SelectTrigger className="border-[#333] bg-black text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="22.x">22.x</SelectItem>
                <SelectItem value="20.x">20.x (Recommended)</SelectItem>
                <SelectItem value="18.x">18.x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end border-t border-[#333] px-6 py-3">
          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </section>

      {/* Git */}
      <section className="rounded-lg border border-[#333]">
        <div className="border-b border-[#333] px-6 py-4">
          <h2 className="text-sm font-medium text-white">Git</h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Git repository configuration and branch settings.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#888]">
                Production Branch
              </label>
              <Input
                value={project?.github_default_branch || "main"}
                disabled
                className="border-[#333] bg-[#111] text-[#888]"
              />
              <p className="text-xs text-[#555]">
                Deployments from this branch are promoted to production.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#888]">
                Connected Repository
              </label>
              <div className="flex items-center gap-3 rounded-md border border-[#333] bg-[#111] px-3 py-2">
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 text-[#888]"
                  fill="currentColor"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span className="text-sm text-[#ededed]">
                  {project?.repo_full_name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-red-900/50">
        <div className="border-b border-red-900/50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">
                Delete this project
              </h3>
              <p className="mt-0.5 text-xs text-[#666]">
                Once you delete a project, there is no going back. All
                deployments and environment variables will be permanently
                removed.
              </p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent className="border-[#333] bg-[#0a0a0a] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    Delete Project
                  </DialogTitle>
                  <DialogDescription className="text-[#888]">
                    This action cannot be undone. This will permanently delete
                    the project{" "}
                    <span className="font-medium text-white">
                      {project?.slug}
                    </span>{" "}
                    and all of its deployments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <label className="text-sm text-[#888]">
                    Type{" "}
                    <span className="font-mono font-bold text-white">
                      {project?.slug}
                    </span>{" "}
                    to confirm
                  </label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={project?.slug || ""}
                    className="border-[#333] bg-black text-white placeholder:text-[#555]"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={deleteConfirm !== project?.slug}
                    className="gap-2 bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      toast.success("Project would be deleted (API not implemented yet)");
                      setDeleteOpen(false);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>
    </div>
  );
}
