"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function VercelLogo() {
  return (
    <svg height="26" viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gh, setGh] = useState<{ configured: boolean } | null>(null);

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
        // ignore
      }
      try {
        const st = (await apiFetch("/api/auth/github/status")) as { configured: boolean };
        setGh(st);
      } catch {
        setGh({ configured: false });
      }
    })();
  }, [router]);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      toast.success("Logged in");
      router.replace("/projects");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <VercelLogo />
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Log in to OpenCel
          </h1>
        </div>

        <div className="space-y-4">
          {/* GitHub OAuth */}
          {gh?.configured && (
            <>
              <Button asChild variant="outline" className="h-11 w-full gap-2 border-[#333] bg-transparent text-[#ededed] hover:bg-[#111] hover:text-white">
                <a href="/api/auth/github/start?return_to=/projects">
                  <Github className="h-5 w-5" />
                  Continue with GitHub
                </a>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#333]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-black px-3 text-[#666]">or</span>
                </div>
              </div>
            </>
          )}

          {/* Email / Password */}
          <div className="space-y-2">
            <label className="text-sm text-[#888]">Email Address</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 border-[#333] bg-black text-white placeholder:text-[#555] focus-visible:ring-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[#888]">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter password"
              className="h-11 border-[#333] bg-black text-white placeholder:text-[#555] focus-visible:ring-white"
            />
          </div>

          <Button
            className="h-11 w-full gap-2 font-medium"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-[13px] text-[#666]">
            First time?{" "}
            <Link href="/setup" className="text-white underline underline-offset-4 hover:text-[#ededed]">
              Run initial setup
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
