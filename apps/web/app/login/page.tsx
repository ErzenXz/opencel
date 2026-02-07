"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        const st = (await apiFetch("/api/auth/github/status")) as any;
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
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
          <Button className="w-full" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
