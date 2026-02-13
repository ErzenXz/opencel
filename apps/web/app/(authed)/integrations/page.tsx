"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Filter,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  installed: boolean;
  popular: boolean;
  verified: boolean;
  url: string;
};

const CATEGORIES = [
  "All",
  "Monitoring",
  "Databases",
  "Analytics",
  "Security",
  "CMS",
  "AI / ML",
  "Commerce",
  "Logging",
];

const INTEGRATIONS: Integration[] = [
  {
    id: "sentry",
    name: "Sentry",
    description:
      "Application monitoring with error tracking and performance insights.",
    icon: "🛡️",
    category: "Monitoring",
    installed: false,
    popular: true,
    verified: true,
    url: "https://sentry.io",
  },
  {
    id: "datadog",
    name: "Datadog",
    description:
      "Cloud-scale monitoring and security for your applications and infrastructure.",
    icon: "🐶",
    category: "Monitoring",
    installed: false,
    popular: true,
    verified: true,
    url: "https://datadoghq.com",
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    description:
      "Serverless MySQL platform with branching, deploy requests, and insights.",
    icon: "🌐",
    category: "Databases",
    installed: true,
    popular: true,
    verified: true,
    url: "https://planetscale.com",
  },
  {
    id: "neon",
    name: "Neon",
    description:
      "Serverless Postgres with branching, autoscaling, and bottomless storage.",
    icon: "⚡",
    category: "Databases",
    installed: false,
    popular: true,
    verified: true,
    url: "https://neon.tech",
  },
  {
    id: "upstash",
    name: "Upstash",
    description:
      "Serverless Redis and Kafka for your applications with pay-per-request pricing.",
    icon: "🔺",
    category: "Databases",
    installed: true,
    popular: true,
    verified: true,
    url: "https://upstash.com",
  },
  {
    id: "axiom",
    name: "Axiom",
    description:
      "Log management and analytics platform with unlimited data retention.",
    icon: "📊",
    category: "Logging",
    installed: false,
    popular: false,
    verified: true,
    url: "https://axiom.co",
  },
  {
    id: "checkly",
    name: "Checkly",
    description:
      "API and browser monitoring with Playwright-based synthetic checks.",
    icon: "✅",
    category: "Monitoring",
    installed: false,
    popular: false,
    verified: true,
    url: "https://checklyhq.com",
  },
  {
    id: "sanity",
    name: "Sanity",
    description:
      "Composable content cloud with real-time collaboration and structured content.",
    icon: "📝",
    category: "CMS",
    installed: false,
    popular: true,
    verified: true,
    url: "https://sanity.io",
  },
  {
    id: "contentful",
    name: "Contentful",
    description:
      "Headless CMS that lets you create, manage and distribute content.",
    icon: "📄",
    category: "CMS",
    installed: false,
    popular: false,
    verified: true,
    url: "https://contentful.com",
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Payment processing platform for internet businesses of all sizes.",
    icon: "💳",
    category: "Commerce",
    installed: false,
    popular: true,
    verified: true,
    url: "https://stripe.com",
  },
  {
    id: "replicate",
    name: "Replicate",
    description:
      "Run machine learning models in the cloud with a simple API.",
    icon: "🤖",
    category: "AI / ML",
    installed: false,
    popular: true,
    verified: true,
    url: "https://replicate.com",
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "GPT models and embeddings API for building intelligent applications.",
    icon: "🧠",
    category: "AI / ML",
    installed: false,
    popular: true,
    verified: true,
    url: "https://openai.com",
  },
  {
    id: "crowdstrike",
    name: "CrowdStrike",
    description:
      "Endpoint protection and threat intelligence for cloud workloads.",
    icon: "🔒",
    category: "Security",
    installed: false,
    popular: false,
    verified: true,
    url: "https://crowdstrike.com",
  },
  {
    id: "snyk",
    name: "Snyk",
    description:
      "Developer-first security to find and fix vulnerabilities in dependencies.",
    icon: "🐍",
    category: "Security",
    installed: false,
    popular: false,
    verified: true,
    url: "https://snyk.io",
  },
  {
    id: "amplitude",
    name: "Amplitude",
    description:
      "Product analytics to understand user behavior and drive growth.",
    icon: "📈",
    category: "Analytics",
    installed: false,
    popular: false,
    verified: true,
    url: "https://amplitude.com",
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    description:
      "Event analytics that helps you understand how users engage with your product.",
    icon: "🔬",
    category: "Analytics",
    installed: false,
    popular: false,
    verified: true,
    url: "https://mixpanel.com",
  },
];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [installed, setInstalled] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    INTEGRATIONS.forEach((i) => {
      if (i.installed) m[i.id] = true;
    });
    return m;
  });

  const filtered = INTEGRATIONS.filter((i) => {
    if (category !== "All" && i.category !== category) return false;
    if (
      search &&
      !i.name.toLowerCase().includes(search.toLowerCase()) &&
      !i.description.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const installedCount = Object.values(installed).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Browse and install integrations to extend your workflow.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#888]">
          <span className="rounded-full bg-[#0070f3]/10 px-2.5 py-1 text-[#0070f3]">
            {installedCount} installed
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-[#333] bg-[#0a0a0a] pl-9 pr-3 text-sm text-white placeholder-[#555] outline-none focus:border-[#555]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "rounded-md p-2 transition-colors",
              view === "grid"
                ? "bg-[#333] text-white"
                : "text-[#666] hover:text-white"
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-md p-2 transition-colors",
              view === "list"
                ? "bg-[#333] text-white"
                : "text-[#666] hover:text-white"
            )}
          >
            <LayoutList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              category === c
                ? "bg-white text-black"
                : "bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-white"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Filter className="mx-auto h-8 w-8 text-[#333]" />
            <p className="mt-3 text-sm text-[#888]">No integrations found.</p>
          </div>
        </div>
      )}

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ig) => (
            <div
              key={ig.id}
              className="group flex flex-col justify-between rounded-lg border border-[#333] bg-[#0a0a0a] p-5 transition-colors hover:border-[#555]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ig.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {ig.name}
                        </span>
                        {ig.verified && (
                          <Check className="h-3.5 w-3.5 text-[#0070f3]" />
                        )}
                      </div>
                      <span className="text-xs text-[#666]">
                        {ig.category}
                      </span>
                    </div>
                  </div>
                  {ig.popular && (
                    <Star className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <p className="mt-3 text-xs leading-5 text-[#888]">
                  {ig.description}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {installed[ig.id] ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                    Installed
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      setInstalled((p) => ({ ...p, [ig.id]: true }))
                    }
                    className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#ccc]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Install
                  </button>
                )}
                <a
                  href={ig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#666] transition-colors hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#333]">
          {filtered.map((ig, idx) => (
            <div
              key={ig.id}
              className={cn(
                "flex items-center justify-between p-4 transition-colors hover:bg-[#111]",
                idx > 0 && "border-t border-[#333]"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{ig.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {ig.name}
                    </span>
                    {ig.verified && (
                      <Check className="h-3.5 w-3.5 text-[#0070f3]" />
                    )}
                    {ig.popular && (
                      <Star className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#888]">
                    {ig.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 text-xs text-[#888]">
                  {ig.category}
                </span>
                {installed[ig.id] ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <Check className="h-3.5 w-3.5" />
                    Installed
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      setInstalled((p) => ({ ...p, [ig.id]: true }))
                    }
                    className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-[#ccc]"
                  >
                    Install
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Build your own banner */}
      <div className="rounded-lg border border-dashed border-[#333] p-6 text-center">
        <p className="text-sm font-medium text-white">
          Build your own integration
        </p>
        <p className="mt-1 text-xs text-[#888]">
          Use the OpenCel API and webhooks to build custom integrations.
        </p>
        <button className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#333] bg-[#0a0a0a] px-4 py-2 text-xs font-medium text-white hover:border-[#555]">
          Read the Docs
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
