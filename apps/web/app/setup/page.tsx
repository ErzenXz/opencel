"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
        const st = (await apiFetch("/api/setup/status")) as { needs_setup: boolean };
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
        body: JSON.stringify({ email, password, org_name: orgName })
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
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to OpenCel</CardTitle>
          <CardDescription>Create your first user and organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Password</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Organization</div>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Personal" />
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create account"}
          </Button>
          <div className="text-xs text-muted-foreground">
            After setup, configure a GitHub App in Settings to enable deploy-on-push.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

