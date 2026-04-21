"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("Personal");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const st = (await apiFetch("/api/setup/status")) as {
          needs_setup: boolean;
        };
        if (!st.needs_setup) {
          router.replace("/login");
          return;
        }
      } catch {
        // If status fails, still show setup.
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await apiFetch("/api/setup", {
        method: "POST",
        body: JSON.stringify({ email, password, org_name: orgName }),
      });
      toast.success("Setup complete");
      router.replace("/projects");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-hero-radial">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-brand" />
          <span className="text-sm text-[#888]">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hero-radial px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-4">
          <BrandLogo variant="mark" size={36} />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Welcome to <span className="text-brand-gradient">OpenCel</span>
            </h1>
            <p className="mt-2 text-sm text-[#9b9b9b]">
              Create your first admin account and team.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-[#0a0a0a]/80 p-6 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#9b9b9b]">Email address</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="h-11 border-[#2a2a2a] bg-black text-white placeholder:text-[#555] focus-visible:ring-brand"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#9b9b9b]">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="h-11 border-[#2a2a2a] bg-black text-white placeholder:text-[#555] focus-visible:ring-brand"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#9b9b9b]">Team name</label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Personal"
                className="h-11 border-[#2a2a2a] bg-black text-white placeholder:text-[#555] focus-visible:ring-brand"
              />
            </div>

            <Button
              variant="brand"
              className="h-11 w-full font-medium"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Create account"
              )}
            </Button>

            <p className="text-center text-[13px] text-[#666]">
              After setup, configure a GitHub App in Admin to enable
              deploy-on-push.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
