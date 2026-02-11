"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Cloud, Rocket, ShieldCheck } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="min-h-screen bg-[radial-gradient(80%_75%_at_100%_0%,hsl(var(--primary)/0.15),transparent)] p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-4xl tracking-tight">OpenCel</CardTitle>
            <CardDescription className="text-base">
              The open-source, self-hosted platform for Vercel-style deployments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Cloud className="mt-0.5 h-4 w-4" />
              <span>Deploy web services, static pages, and tooling projects from GitHub.</span>
            </div>
            <div className="flex items-start gap-2">
              <Rocket className="mt-0.5 h-4 w-4" />
              <span>Preview every change, then promote one-click to production.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4" />
              <span>Keep control of your infrastructure with a clean OSS control plane.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button asChild>
                <Link href="/login" className="gap-2">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/setup">Run Setup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-center">
          <div className="rounded-xl border border-border/70 bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
            Checking your session and routing...
          </div>
        </div>
      </div>
    </main>
  );
}

