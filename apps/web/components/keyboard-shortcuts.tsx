"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  {
    category: "General",
    items: [
      { keys: ["⌘", "K"], description: "Open Command Palette" },
      { keys: ["⌘", "/"], description: "Show Keyboard Shortcuts" },
      { keys: ["Esc"], description: "Close dialog / palette" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: ["G", "then", "D"], description: "Go to Dashboard" },
      { keys: ["G", "then", "P"], description: "Go to Projects" },
      { keys: ["G", "then", "I"], description: "Go to Import" },
      { keys: ["G", "then", "T"], description: "Go to Teams" },
      { keys: ["G", "then", "S"], description: "Go to Settings" },
    ],
  },
  {
    category: "Projects",
    items: [
      { keys: ["C"], description: "Create new project" },
      { keys: ["F"], description: "Focus search" },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      // ⌘/ to open shortcuts
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // Ignore if in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // G + key navigation
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 800);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimeout);
        const routes: Record<string, string> = {
          d: "/dashboard",
          p: "/projects",
          i: "/import",
          t: "/orgs",
          s: "/settings",
        };
        if (routes[e.key]) {
          e.preventDefault();
          window.location.href = routes[e.key];
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-[#333] bg-[#0a0a0a] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#666]">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between rounded-md px-2 py-1.5"
                  >
                    <span className="text-sm text-[#ededed]">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) =>
                        key === "then" ? (
                          <span key={i} className="text-xs text-[#555]">
                            then
                          </span>
                        ) : (
                          <kbd
                            key={i}
                            className="flex h-6 min-w-[24px] items-center justify-center rounded border border-[#333] bg-[#111] px-1.5 font-mono text-[11px] text-[#888]"
                          >
                            {key}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-[#222] pt-3 text-center">
          <p className="text-xs text-[#555]">
            Press{" "}
            <kbd className="rounded border border-[#333] bg-[#111] px-1 font-mono text-[10px] text-[#888]">
              ⌘/
            </kbd>{" "}
            to toggle this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
