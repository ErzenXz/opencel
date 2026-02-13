"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  Globe,
  MapPin,
  Monitor,
  MousePointer2,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type PageView = {
  path: string;
  views: number;
  uniques: number;
  avgDuration: number;
  bounceRate: number;
};

type Referrer = {
  source: string;
  visitors: number;
  pct: number;
};

type Country = {
  name: string;
  flag: string;
  visitors: number;
  pct: number;
};

const PAGES: PageView[] = [
  { path: "/", views: 12480, uniques: 8920, avgDuration: 45, bounceRate: 32 },
  {
    path: "/pricing",
    views: 5230,
    uniques: 4100,
    avgDuration: 120,
    bounceRate: 28,
  },
  {
    path: "/docs",
    views: 3890,
    uniques: 2950,
    avgDuration: 240,
    bounceRate: 15,
  },
  {
    path: "/blog",
    views: 2740,
    uniques: 2100,
    avgDuration: 180,
    bounceRate: 42,
  },
  {
    path: "/about",
    views: 1560,
    uniques: 1280,
    avgDuration: 60,
    bounceRate: 55,
  },
  {
    path: "/contact",
    views: 890,
    uniques: 780,
    avgDuration: 90,
    bounceRate: 38,
  },
  {
    path: "/careers",
    views: 620,
    uniques: 540,
    avgDuration: 150,
    bounceRate: 25,
  },
  {
    path: "/changelog",
    views: 410,
    uniques: 350,
    avgDuration: 200,
    bounceRate: 18,
  },
];

const REFERRERS: Referrer[] = [
  { source: "Google", visitors: 8420, pct: 42 },
  { source: "Direct", visitors: 5280, pct: 26 },
  { source: "Twitter / X", visitors: 2340, pct: 12 },
  { source: "GitHub", visitors: 1890, pct: 9 },
  { source: "Hacker News", visitors: 1120, pct: 6 },
  { source: "Reddit", visitors: 680, pct: 3 },
  { source: "LinkedIn", visitors: 400, pct: 2 },
];

const COUNTRIES: Country[] = [
  { name: "United States", flag: "🇺🇸", visitors: 8200, pct: 41 },
  { name: "Germany", flag: "🇩🇪", visitors: 2840, pct: 14 },
  { name: "United Kingdom", flag: "🇬🇧", visitors: 2100, pct: 11 },
  { name: "France", flag: "🇫🇷", visitors: 1560, pct: 8 },
  { name: "Japan", flag: "🇯🇵", visitors: 1200, pct: 6 },
  { name: "Canada", flag: "🇨🇦", visitors: 980, pct: 5 },
  { name: "India", flag: "🇮🇳", visitors: 860, pct: 4 },
  { name: "Brazil", flag: "🇧🇷", visitors: 620, pct: 3 },
];

const DEVICES = [
  { name: "Desktop", pct: 68, icon: Monitor },
  { name: "Mobile", pct: 26, icon: Smartphone },
  { name: "Tablet", pct: 6, icon: Tablet },
];

const TIME_RANGES = ["24h", "7d", "30d", "90d"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

function MiniChart() {
  const [bars] = useState(() =>
    Array.from({ length: 24 }, () => rand(20, 100))
  );
  const max = Math.max(...bars);
  return (
    <div className="flex h-20 items-end gap-[2px]">
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-[#0070f3] transition-all hover:bg-[#0070f3]/80"
          style={{ height: `${(v / max) * 100}%` }}
          title={`${v} visitors`}
        />
      ))}
    </div>
  );
}

function formatNum(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function WebAnalyticsPage() {
  const [range, setRange] = useState<TimeRange>("7d");
  const [liveVisitors, setLiveVisitors] = useState(rand(120, 380));

  useEffect(() => {
    const iv = setInterval(() => {
      setLiveVisitors((p) => p + rand(-5, 8));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const totalViews = PAGES.reduce((a, p) => a + p.views, 0);
  const totalUniques = PAGES.reduce((a, p) => a + p.uniques, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Web Analytics
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Privacy-friendly analytics across all your projects.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[#333] bg-[#0a0a0a] p-0.5">
          {TIME_RANGES.map((t) => (
            <button
              key={t}
              onClick={() => setRange(t)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                range === t
                  ? "bg-[#333] text-white"
                  : "text-[#888] hover:text-white"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Live + Stats */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-[#333] bg-[#333] sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-[#0a0a0a] p-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-[#666]">
              Live Visitors
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {liveVisitors}
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#666]">
            <Eye className="h-3.5 w-3.5" />
            Page Views
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {formatNum(totalViews)}
          </p>
          <span className="mt-1 flex items-center gap-1 text-xs text-emerald-500">
            <ArrowUpRight className="h-3 w-3" />
            +12.3%
          </span>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#666]">
            <Users className="h-3.5 w-3.5" />
            Unique Visitors
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            {formatNum(totalUniques)}
          </p>
          <span className="mt-1 flex items-center gap-1 text-xs text-emerald-500">
            <ArrowUpRight className="h-3 w-3" />
            +8.7%
          </span>
        </div>
        <div className="bg-[#0a0a0a] p-5">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#666]">
            <MousePointer2 className="h-3.5 w-3.5" />
            Bounce Rate
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">
            32%
          </p>
          <span className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <ArrowDownRight className="h-3 w-3" />
            +2.1%
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#666]" />
          <span className="text-sm font-medium text-white">
            Visitors over time
          </span>
        </div>
        <MiniChart />
        <div className="mt-2 flex justify-between text-xs text-[#555]">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>Now</span>
        </div>
      </div>

      {/* Three columns: Pages, Referrers, Countries */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pages */}
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
          <h3 className="mb-3 text-sm font-medium text-white">Top Pages</h3>
          <div className="space-y-2">
            {PAGES.slice(0, 6).map((pg) => (
              <div key={pg.path} className="group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#ededed] group-hover:text-[#0070f3]">
                    {pg.path}
                  </span>
                  <span className="text-xs tabular-nums text-[#888]">
                    {formatNum(pg.views)}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-[#222]">
                  <div
                    className="h-full rounded-full bg-[#0070f3]/40"
                    style={{
                      width: `${(pg.views / PAGES[0].views) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referrers */}
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
          <h3 className="mb-3 text-sm font-medium text-white">
            Top Referrers
          </h3>
          <div className="space-y-2.5">
            {REFERRERS.map((r) => (
              <div key={r.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-[#555]" />
                  <span className="text-xs text-[#ededed]">{r.source}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-[#888]">
                    {formatNum(r.visitors)}
                  </span>
                  <span className="w-8 text-right text-xs tabular-nums text-[#555]">
                    {r.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <MapPin className="h-4 w-4 text-[#666]" />
            Countries
          </h3>
          <div className="space-y-2.5">
            {COUNTRIES.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.flag}</span>
                  <span className="text-xs text-[#ededed]">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-[#888]">
                    {formatNum(c.visitors)}
                  </span>
                  <span className="w-8 text-right text-xs tabular-nums text-[#555]">
                    {c.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Devices */}
      <div className="rounded-lg border border-[#333] bg-[#0a0a0a] p-5">
        <h3 className="mb-4 text-sm font-medium text-white">Devices</h3>
        <div className="flex gap-6">
          {DEVICES.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <d.icon className="h-5 w-5 text-[#666]" />
              <div>
                <p className="text-sm font-medium text-white">{d.name}</p>
                <p className="text-xs text-[#888]">{d.pct}%</p>
              </div>
              <div className="ml-2 h-2 w-24 rounded-full bg-[#222]">
                <div
                  className="h-full rounded-full bg-[#0070f3]"
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
