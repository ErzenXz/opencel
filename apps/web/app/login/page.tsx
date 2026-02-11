"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <main className="min-h-screen bg-[radial-gradient(70%_70%_at_100%_0%,hsl(var(--primary)/0.12),transparent)] p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              OpenCel Dashboard
            </div>
            <CardTitle className="text-3xl tracking-tight">Open source cloud, on your own terms</CardTitle>
            <CardDescription>Deploy GitHub projects with preview links, logs, and production promotion in one control plane.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>- Vercel-like workflow without platform lock-in</p>
            <p>- Great for web services, static sites, and database tooling</p>
            <p>- Self-hosted and OSS from the first commit</p>
          </CardContent>
        </Card>

        <Card className="w-full border-border/70">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Sign in to your OpenCel dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gh?.configured ? (
              <Button asChild variant="secondary" className="w-full">
                <a href="/api/auth/github/start?return_to=/projects">Continue with GitHub</a>
              </Button>
            ) : null}
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button className="w-full gap-2" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
              {submitting ? null : <ArrowRight className="h-4 w-4" />}
            </Button>
            <div className="text-center text-xs text-muted-foreground">
              New here? <Link href="/setup" className="underline underline-offset-4">Run initial setup</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
