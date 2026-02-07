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
        router.replace("/projects");
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </main>
  );
}

