"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gh, setGh] = useState<{ configured: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = (await apiFetch("/api/setup/status")) as {
          needs_setup: boolean;
        };
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
        const st = (await apiFetch("/api/auth/github/status")) as {
          configured: boolean;
        };
        setGh(st);
      } catch {
        setGh({ configured: false });
      }
    })();
  }, [router]);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      toast.success("Logged in");
      router.replace("/projects");
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-hero-radial lg:flex-row">
      {/* Decorative grid on the full surface (subtle) */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      {/* Left: marketing panel (lg+) */}
      <section className="relative hidden flex-1 flex-col justify-between px-12 py-10 lg:flex">
        <Link
          href="/"
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <BrandLogo variant="full" size={24} />
        </Link>

        <div className="relative space-y-6">
          <h2 className="max-w-[520px] text-4xl font-semibold leading-[1.1] tracking-tight text-white">
            Ship from push to{" "}
            <span className="text-brand-gradient">production</span>,
            <br />
            on infrastructure you own.
          </h2>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-[#9b9b9b]">
            OpenCel is an open-source, self-hosted deployment platform. Connect a
            repo, get preview URLs on every pull request, promote to production,
            and stream live build logs — all on your own VPS.
          </p>

          <ul className="space-y-2.5 text-sm text-[#c5c5c5]">
            {[
              "Build & deploy on every push or PR",
              "Preview URLs per deployment",
              "Encrypted environment variables",
              "Docker Compose on your own host",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="bg-brand-gradient inline-block h-1.5 w-1.5 rounded-full" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[#666]">
          © {new Date().getFullYear()} OpenCel · MIT License
        </p>
      </section>

      {/* Right: login card */}
      <section className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[380px]">
          {/* Compact brand on mobile */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <BrandLogo variant="mark" size={30} />
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Log in to OpenCel
            </h1>
            <p className="mt-1.5 text-sm text-[#888]">
              Welcome back. Continue to your workspace.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-[#222] bg-[#0a0a0a]/80 p-6 backdrop-blur-xl">
            {gh?.configured && (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full gap-2 border-[#2a2a2a] bg-transparent text-[#ededed] hover:border-[#444] hover:bg-[#111] hover:text-white"
                >
                  <a href="/api/auth/github/start?return_to=/projects">
                    <Github className="h-5 w-5" />
                    Continue with GitHub
                  </a>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#222]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#0a0a0a] px-3 text-[#666]">
                      or with email
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm text-[#9b9b9b]">Email address</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 border-[#2a2a2a] bg-black text-white placeholder:text-[#555] focus-visible:ring-brand"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[#9b9b9b]">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                className="h-11 border-[#2a2a2a] bg-black text-white placeholder:text-[#555] focus-visible:ring-brand"
              />
            </div>

            <Button
              variant="brand"
              className="h-11 w-full gap-2 font-medium"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <p className="mt-6 text-center text-[13px] text-[#666]">
            First time?{" "}
            <Link
              href="/setup"
              className="text-white underline-offset-4 hover:text-brand hover:underline"
            >
              Run initial setup
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
