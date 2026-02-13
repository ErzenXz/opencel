"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  GitBranch,
  Info,
  Rocket,
  Settings,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  type: "deploy_success" | "deploy_failed" | "info" | "warning" | "invite";
  title: string;
  message: string;
  project?: string;
  read: boolean;
  timestamp: string;
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "deploy_success",
    title: "Deployment succeeded",
    message: "Production deployment completed in 34s.",
    project: "my-app",
    read: false,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    type: "deploy_failed",
    title: "Build failed",
    message: "Build failed at step 'npm run build' — exit code 1.",
    project: "api-service",
    read: false,
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    type: "info",
    title: "New team member joined",
    message: "jane@example.com accepted the invitation to your team.",
    read: false,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    type: "warning",
    title: "Approaching bandwidth limit",
    message: "You have used 87% of your monthly bandwidth allocation.",
    read: true,
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    type: "deploy_success",
    title: "Deployment succeeded",
    message: "Preview deployment for branch feature/auth ready.",
    project: "web-dashboard",
    read: true,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "6",
    type: "invite",
    title: "Team invitation",
    message: "You've been invited to join the 'platform' team.",
    read: true,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_CONFIG = {
  deploy_success: {
    icon: Rocket,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  deploy_failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  info: {
    icon: Info,
    color: "text-[#0070f3]",
    bg: "bg-[#0070f3]/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  invite: {
    icon: GitBranch,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] =
    useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifications((p) =>
      p.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function markAllRead() {
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifications((p) => p.filter((n) => n.id !== id));
  }

  function clearAll() {
    setNotifications([]);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notification-panel]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-notification-panel>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 text-[#888] transition-colors hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-lg border border-[#333] bg-[#0a0a0a] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#333] px-4 py-3">
            <span className="text-sm font-medium text-white">
              Notifications
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-[#888] hover:text-white"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-xs text-[#888] hover:text-white"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Bell className="h-6 w-6 text-[#333]" />
                <p className="mt-2 text-sm text-[#888]">
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group flex gap-3 border-b border-[#222] px-4 py-3 transition-colors hover:bg-[#111]",
                      !n.read && "bg-[#0070f3]/[0.03]"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        cfg.bg
                      )}
                    >
                      <cfg.icon className={cn("h-3.5 w-3.5", cfg.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              n.read
                                ? "text-[#888]"
                                : "font-medium text-white"
                            )}
                          >
                            {n.title}
                          </p>
                          {n.project && (
                            <span className="text-xs text-[#0070f3]">
                              {n.project}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!n.read && (
                            <button
                              onClick={() => markRead(n.id)}
                              className="rounded p-1 text-[#555] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                              title="Mark read"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(n.id)}
                            className="rounded p-1 text-[#555] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                            title="Dismiss"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-[#666]">
                        {n.message}
                      </p>
                      <p className="mt-1 text-xs text-[#555]">
                        {timeAgo(n.timestamp)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0070f3]" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#333] px-4 py-2.5 text-center">
            <button className="flex w-full items-center justify-center gap-1.5 text-xs text-[#888] hover:text-white">
              <Settings className="h-3 w-3" />
              Notification Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
