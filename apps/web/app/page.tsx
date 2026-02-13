"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const st = (await apiFetch("/api/setup/status")) as { needs_setup: boolean };
        if (st.needs_setup) {
          router.replace("/setup");
          return;
        }
      } catch {
        // ignore
      }
      try {
        await apiFetch("/api/me");
        router.replace("/dashboard");
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-white" />
        <span className="text-sm text-[#888]">Redirecting...</span>
      </div>
    </main>
  );
}

