"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Project = {
  id: string;
  slug: string;
  repo_full_name: string;
};

type Domain = {
  domain: string;
  status: "valid" | "pending" | "invalid";
  ssl: boolean;
  addedAt: string;
};

function DomainStatusIcon({ status }: { status: Domain["status"] }) {
  switch (status) {
    case "valid":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "pending":
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    case "invalid":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

export default function DomainsPage() {
  const params = useParams<{ id: string }>();
  const projectID = params?.id;
  const [project, setProject] = useState<Project | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!projectID) return;
      try {
        const p = (await apiFetch(`/api/projects/${projectID}`)) as Project;
        setProject(p);
        // Simulate domain data - in a real app this would come from an API
        setDomains([
          {
            domain: `${p.slug}.opencel.app`,
            status: "valid",
            ssl: true,
            addedAt: new Date().toISOString(),
          },
        ]);
      } catch (e: any) {
        toast.error(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectID]);

  function addDomain() {
    if (!newDomain.trim()) return;
    const d: Domain = {
      domain: newDomain.trim(),
      status: "pending",
      ssl: false,
      addedAt: new Date().toISOString(),
    };
    setDomains((prev) => [...prev, d]);
    setNewDomain("");
    setAddOpen(false);
    toast.success(`Domain ${d.domain} added. DNS verification pending.`);
    // Simulate verification after 3 seconds
    setTimeout(() => {
      setDomains((prev) =>
        prev.map((dom) =>
          dom.domain === d.domain
            ? { ...dom, status: "valid", ssl: true }
            : dom
        )
      );
      toast.success(`Domain ${d.domain} verified!`);
    }, 3000);
  }

  function removeDomain(domain: string) {
    setDomains((prev) => prev.filter((d) => d.domain !== domain));
    toast.success(`Domain ${domain} removed.`);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects" className="text-[#888] hover:text-white">
                Projects
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href={`/projects/${projectID}`}
                className="text-[#888] hover:text-white"
              >
                {project?.slug || "Project"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5 text-[#555]" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-white">Domains</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Domains
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Manage custom domains for {project?.slug || "your project"}.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#333] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle className="text-white">Add Domain</DialogTitle>
              <DialogDescription className="text-[#888]">
                Enter a custom domain to point to this project. You&apos;ll need
                to configure DNS records.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="border-[#333] bg-black text-white placeholder:text-[#555]"
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
            />
            <div className="rounded-lg bg-[#111] p-3">
              <p className="text-xs font-medium text-[#888]">
                DNS Configuration
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-3 font-mono text-xs">
                  <Badge
                    variant="outline"
                    className="border-[#333] text-[10px] text-[#888]"
                  >
                    A
                  </Badge>
                  <span className="text-[#666]">@</span>
                  <span className="text-[#ededed]">76.76.21.21</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <Badge
                    variant="outline"
                    className="border-[#333] text-[10px] text-[#888]"
                  >
                    CNAME
                  </Badge>
                  <span className="text-[#666]">www</span>
                  <span className="text-[#ededed]">cname.opencel.app</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="border-[#333] bg-transparent text-[#ededed] hover:bg-[#111]"
              >
                Cancel
              </Button>
              <Button onClick={addDomain} disabled={!newDomain.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domains List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-[80px] animate-pulse rounded-lg border border-[#333] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333] py-16 text-center">
          <Globe className="mb-3 h-8 w-8 text-[#555]" />
          <p className="text-sm text-[#888]">No custom domains configured.</p>
          <p className="mt-1 text-xs text-[#555]">
            Add a custom domain to make your project accessible at your own URL.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            Add Domain
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <div
              key={d.domain}
              className="rounded-lg border border-[#333] bg-[#0a0a0a] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DomainStatusIcon status={d.status} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {d.domain}
                      </span>
                      {d.ssl && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500">
                          <Shield className="h-3 w-3" />
                          SSL
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[#666]">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-[#333] text-[10px]",
                          d.status === "valid" &&
                            "border-emerald-800/50 text-emerald-400",
                          d.status === "pending" &&
                            "border-yellow-800/50 text-yellow-400",
                          d.status === "invalid" &&
                            "border-red-800/50 text-red-400"
                        )}
                      >
                        {d.status === "valid"
                          ? "Configured"
                          : d.status === "pending"
                            ? "Pending Verification"
                            : "Configuration Error"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-xs text-[#888] hover:text-white"
                      onClick={() => {
                        setDomains((prev) =>
                          prev.map((dom) =>
                            dom.domain === d.domain
                              ? { ...dom, status: "valid", ssl: true }
                              : dom
                          )
                        );
                        toast.success("Domain verified!");
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Verify
                    </Button>
                  )}
                  {!d.domain.endsWith(".opencel.app") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => removeDomain(d.domain)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* DNS Instructions for pending */}
              {d.status === "pending" && (
                <div className="mt-3 rounded-lg bg-[#111] p-3">
                  <p className="text-xs font-medium text-[#888]">
                    Add the following DNS records:
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#666]">
                          <th className="pb-1 pr-4 text-left font-medium">
                            Type
                          </th>
                          <th className="pb-1 pr-4 text-left font-medium">
                            Name
                          </th>
                          <th className="pb-1 text-left font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-[#ededed]">
                        <tr>
                          <td className="pr-4 py-0.5">A</td>
                          <td className="pr-4 py-0.5">@</td>
                          <td className="py-0.5">76.76.21.21</td>
                        </tr>
                        <tr>
                          <td className="pr-4 py-0.5">CNAME</td>
                          <td className="pr-4 py-0.5">www</td>
                          <td className="py-0.5">cname.opencel.app</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
