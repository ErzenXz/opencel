"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  Import,
  Search,
  Settings,
  Shield,
  ArrowRight,
  FileCode2,
  Globe,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getStoredOrgID, type Me } from "@/components/app-shell";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
};

export function CommandPalette({ me }: { me: Me | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects for search
  useEffect(() => {
    if (!open) return;
    const orgID = getStoredOrgID();
    if (!orgID) return;
    (async () => {
      try {
        const ps = (await apiFetch(`/api/orgs/${orgID}/projects`)) as Project[];
        setProjects(ps);
      } catch {
        // ignore
      }
    })();
  }, [open]);

  // ⌘K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const items: CommandItem[] = useMemo(() => {
    const navItems: CommandItem[] = [
      {
        id: "nav-projects",
        label: "Go to Projects",
        description: "View all projects",
        icon: FolderKanban,
        action: () => navigate("/projects"),
        group: "Navigation",
      },
      {
        id: "nav-import",
        label: "Import Project",
        description: "Import from GitHub",
        icon: Import,
        action: () => navigate("/import"),
        group: "Navigation",
      },
      {
        id: "nav-teams",
        label: "Go to Teams",
        description: "Manage team members",
        icon: Building2,
        action: () => navigate("/orgs"),
        group: "Navigation",
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        description: "Account & integrations",
        icon: Settings,
        action: () => navigate("/settings"),
        group: "Navigation",
      },
    ];

    if (me?.is_instance_admin) {
      navItems.push({
        id: "nav-admin",
        label: "Go to Admin",
        description: "Instance configuration",
        icon: Shield,
        action: () => navigate("/admin"),
        group: "Navigation",
      });
    }

    const projectItems: CommandItem[] = projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.slug,
      description: p.repo_full_name,
      icon: FileCode2,
      action: () => navigate(`/projects/${p.id}`),
      group: "Projects",
    }));

    const quickActions: CommandItem[] = [
      {
        id: "action-new-project",
        label: "Create New Project",
        description: "Deploy a new app",
        icon: Zap,
        action: () => navigate("/projects"),
        group: "Quick Actions",
      },
      {
        id: "action-domains",
        label: "Manage Domains",
        description: "Configure project domains",
        icon: Globe,
        action: () => navigate("/admin"),
        group: "Quick Actions",
      },
    ];

    return [...quickActions, ...projectItems, ...navItems];
  }, [navigate, projects, me]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Group items
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group]!.push(item);
    }
    return groups;
  }, [filtered]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selected]?.action();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, selected, filtered]);

  // Reset selection on query change
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] z-[101] w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-[#333] bg-[#0a0a0a] shadow-2xl shadow-black/50">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[#333] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#666]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#555] focus:outline-none"
          />
          <kbd className="hidden rounded border border-[#333] bg-[#111] px-1.5 py-0.5 text-[10px] font-medium text-[#666] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-auto p-2"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[#666]">
              No results found.
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-[#555]">
                  {group}
                </div>
                {items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setSelected(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        selected === idx
                          ? "bg-[#1a1a1a] text-white"
                          : "text-[#888] hover:text-[#ededed]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#666]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{item.label}</div>
                        {item.description && (
                          <div className="truncate text-xs text-[#555]">
                            {item.description}
                          </div>
                        )}
                      </div>
                      {selected === idx && (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#555]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#333] px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-[#555]">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#333] bg-[#111] px-1 py-0.5 font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#333] bg-[#111] px-1 py-0.5 font-mono">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#333] bg-[#111] px-1 py-0.5 font-mono">esc</kbd>
              Close
            </span>
          </div>
          <div className="text-[10px] text-[#555]">OpenCel</div>
        </div>
      </div>
    </>
  );
}
