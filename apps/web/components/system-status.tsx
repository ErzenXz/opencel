"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";

type HealthStatus = "operational" | "degraded" | "down" | "unknown";

export function SystemStatusBanner() {
  const [status, setStatus] = useState<HealthStatus>("unknown");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check API health
    (async () => {
      try {
        const res = await fetch("/api/healthz", { cache: "no-store" });
        if (res.ok) {
          setStatus("operational");
        } else {
          setStatus("degraded");
        }
      } catch {
        setStatus("down");
      }
    })();
    // Re-check every 60 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/healthz", { cache: "no-store" });
        setStatus(res.ok ? "operational" : "degraded");
      } catch {
        setStatus("down");
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Don't show banner when everything is fine or dismissed
  if (status === "operational" || status === "unknown" || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 px-4 py-2 text-sm",
        status === "degraded" && "bg-yellow-500/10 text-yellow-400",
        status === "down" && "bg-red-500/10 text-red-400"
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {status === "degraded"
          ? "Some systems are experiencing issues."
          : "System is currently unavailable. Reconnecting..."}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 shrink-0 rounded-md p-0.5 transition-colors hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SystemStatusIndicator() {
  const [status, setStatus] = useState<HealthStatus>("unknown");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/healthz", { cache: "no-store" });
        setStatus(res.ok ? "operational" : "degraded");
      } catch {
        setStatus("down");
      }
    })();
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-[#666]">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "operational" && "bg-emerald-500",
          status === "degraded" && "bg-yellow-500",
          status === "down" && "bg-red-500",
          status === "unknown" && "bg-[#555]"
        )}
      />
      <span>
        {status === "operational" && "All systems operational"}
        {status === "degraded" && "Degraded performance"}
        {status === "down" && "System down"}
        {status === "unknown" && "Checking..."}
      </span>
    </div>
  );
}
