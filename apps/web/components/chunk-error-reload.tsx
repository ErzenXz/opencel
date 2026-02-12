"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "opencel_chunk_reload_once";

function isChunkLoadFailure(error: unknown): boolean {
  if (!error) return false;
  const msg =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return msg.includes("ChunkLoadError") || msg.includes("Loading chunk");
}

function reloadOnceOnChunkError() {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1") return;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  } catch {
    // Ignore storage issues and still attempt reload.
  }
  window.location.reload();
}

export function ChunkErrorReload() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      // Ignore storage issues.
    }

    const onError = (event: ErrorEvent) => {
      const target = event.target as HTMLScriptElement | HTMLLinkElement | null;
      if (!target) return;
      const src =
        target instanceof HTMLScriptElement
          ? target.src
          : target instanceof HTMLLinkElement
            ? target.href
            : "";
      if (src.includes("/_next/static/")) reloadOnceOnChunkError();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) reloadOnceOnChunkError();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
