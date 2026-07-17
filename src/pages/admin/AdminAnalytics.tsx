import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AdminLayout } from "./AdminLayout";
import { adminApi } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  Users, Eye, UserCheck, Wifi, TrendingUp, Calendar,
  Globe, Smartphone, Monitor, Tablet, Chrome, RefreshCw,
  ArrowUpRight, Clock, MousePointerClick, LayoutGrid
} from "lucide-react";

// ── Color palette ─────────────────────────────────────────────────────────────
const CHART_COLORS = ["#b08a4a", "#d4a853", "#8b6a30", "#e8c878", "#6b4f20", "#f0d898", "#a07840", "#c09848"];
const DEVICE_COLORS: Record<string, string> = {
  desktop: "#b08a4a", mobile: "#d4a853", tablet: "#8b6a30",
};
const SOURCE_COLORS: Record<string, string> = {
  direct: "#6b7280", google: "#4285F4", facebook: "#1877F2",
  instagram: "#E1306C", youtube: "#FF0000", twitter: "#1DA1F2",
  whatsapp: "#25D366", telegram: "#0088CC", bing: "#00809D",
  linkedin: "#0A66C2", referral: "#b08a4a", duckduckgo: "#DE5833",
};

// ── Helper: format seconds to "Xm Ys" ────────────────────────────────────────
function fmtDuration(s: number): string {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, sub, color = "gold",
}: {
  label: string; value: number | string; icon: any; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    gold: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg border ${colorMap[color] ?? colorMap.gold}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-800 mb-3">{children}</h2>;
}

// ── Breakdown Row ─────────────────────────────────────────────────────────────
function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 text-sm text-gray-600 capitalize shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color ?? "#b08a4a" }}
        />
      </div>
      <span className="text-sm text-gray-700 w-10 text-right">{count.toLocaleString()}</span>
      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AdminAnalytics() {
  const [chartRange, setChartRange] = useState<"7d" | "30d" | "12m" | "all">("7d");
  const [liveCount, setLiveCount] = useState<number>(0);

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: () => adminApi.analyticsSummary(),
    refetchInterval: 30_000,
  });

  const { data: chartData } = useQuery({
    queryKey: ["analytics-chart", chartRange],
    queryFn: () => adminApi.analyticsChart(chartRange),
    refetchInterval: 60_000,
  });

  const { data: pagesData } = useQuery({
    queryKey: ["analytics-pages"],
    queryFn: () => adminApi.analyticsPages(),
    refetchInterval: 60_000,
  });

  const { data: devicesData } = useQuery({
    queryKey: ["analytics-devices"],
    queryFn: () => adminApi.analyticsDevices(),
  });

  const { data: geoData } = useQuery({
    queryKey: ["analytics-geo"],
    queryFn: () => adminApi.analyticsGeo(),
  });

  const { data: referrersData } = useQuery({
    queryKey: ["analytics-referrers"],
    queryFn: () => adminApi.analyticsReferrers(),
    refetchInterval: 60_000,
  });

  // Live polling every 30s
  useEffect(() => {
    const poll = () => adminApi.analyticsLive().then((r) => setLiveCount(r.live ?? 0)).catch(() => {});
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, []);

  const s = summary ?? {};
  const chart = (chartData?.chart ?? []) as any[];
  const topPages = (pagesData?.topPages ?? []) as any[];
  const landingPages = (pagesData?.landingPages ?? []) as any[];
  const devices = (devicesData?.devices ?? []) as any[];
  const browsers = (devicesData?.browsers ?? []) as any[];
  const oss = (devicesData?.os ?? []) as any[];
  const countries = (geoData?.countries ?? []) as any[];
  const sources = (referrersData?.sources ?? []) as any[];

  const totalDevices = devices.reduce((a: number, d: any) => a + d.count, 0);
  const totalBrowsers = browsers.reduce((a: number, b: any) => a + b.count, 0);
  const totalOS = oss.reduce((a: number, o: any) => a + o.count, 0);
  const totalSources = sources.reduce((a: number, src: any) => a + src.count, 0);
  const totalCountries = countries.reduce((a: number, c: any) => a + c.count, 0);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time visitor tracking and traffic insights</p>
        </div>
        <button
          onClick={() => refetchSummary()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Live Visitors Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 mb-6 flex items-center gap-4 shadow">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <span className="font-semibold text-lg">{liveCount}</span>
        </div>
        <span className="text-sm opacity-90">live visitor{liveCount !== 1 ? "s" : ""} on site right now (active in last 5 minutes)</span>
      </div>

      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Visits" value={s.totalVisits ?? 0} icon={Eye} color="gold" sub="All time sessions" />
        <StatCard label="Unique Visitors" value={s.totalUnique ?? 0} icon={Users} color="blue" sub="Distinct browsers" />
        <StatCard label="Returning Visitors" value={s.returning ?? 0} icon={UserCheck} color="green" sub="Visited more than once" />
        <StatCard label="Today" value={s.todayVisits ?? 0} icon={Calendar} color="purple" sub="Sessions today" />
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Yesterday" value={s.yesterdayVisits ?? 0} icon={TrendingUp} color="gray" />
        <StatCard label="Last 7 Days" value={s.last7Visits ?? 0} icon={Calendar} color="gold" />
        <StatCard label="Last 30 Days" value={s.last30Visits ?? 0} icon={Calendar} color="blue" />
        <StatCard label="This Month" value={s.monthVisits ?? 0} icon={Calendar} color="green" />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Avg Session Duration" value={fmtDuration(s.avgDuration ?? 0)} icon={Clock} color="gold" sub="Time spent per visit" />
        <StatCard label="Bounce Rate" value={`${s.bounceRate ?? 0}%`} icon={MousePointerClick} color={s.bounceRate > 70 ? "red" : "green"} sub="Single-page sessions" />
        <StatCard label="Avg Pages / Session" value={s.avgPages ?? 0} icon={LayoutGrid} color="blue" sub="Pages viewed per visit" />
      </div>

      {/* Traffic Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionTitle>Traffic Over Time</SectionTitle>
          <div className="flex gap-1">
            {(["7d", "30d", "12m", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartRange === r ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "12m" ? "12 Months" : "All Time"}
              </button>
            ))}
          </div>
        </div>
        {chart.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data yet — start getting visitors!</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visits" stroke="#b08a4a" strokeWidth={2} dot={false} name="Total Visits" />
              <Line type="monotone" dataKey="unique_visitors" stroke="#4285F4" strokeWidth={2} dot={false} name="Unique Visitors" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pages + Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Pages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Most Visited Pages</SectionTitle>
          {topPages.length === 0 ? (
            <p className="text-sm text-gray-400">No page data yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {topPages.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600 truncate flex-1 mr-2">{p.page || "/"}</span>
                  <span className="text-sm font-medium text-gray-800 shrink-0">{(p.views as number).toLocaleString()} <span className="text-gray-400 font-normal text-xs">views</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Landing Pages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Top Landing Pages</SectionTitle>
          {landingPages.length === 0 ? (
            <p className="text-sm text-gray-400">No landing page data yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {landingPages.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600 truncate flex-1 mr-2">{p.page || "/"}</span>
                  <span className="text-sm font-medium text-gray-800 shrink-0">{(p.sessions as number).toLocaleString()} <span className="text-gray-400 font-normal text-xs">sessions</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Device / Browser / OS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Devices */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Devices</SectionTitle>
          {devices.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
            <div className="space-y-0.5">
              {devices.map((d: any) => (
                <BreakdownRow key={d.device} label={d.device} count={d.count} total={totalDevices}
                  color={DEVICE_COLORS[d.device] ?? "#b08a4a"} />
              ))}
            </div>
          )}
        </div>

        {/* Browsers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Browsers</SectionTitle>
          {browsers.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
            <div className="space-y-0.5">
              {browsers.map((b: any, i: number) => (
                <BreakdownRow key={b.browser} label={b.browser} count={b.count} total={totalBrowsers}
                  color={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </div>
          )}
        </div>

        {/* OS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Operating Systems</SectionTitle>
          {oss.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
            <div className="space-y-0.5">
              {oss.map((o: any, i: number) => (
                <BreakdownRow key={o.os} label={o.os} count={o.count} total={totalOS}
                  color={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Traffic Sources + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Traffic Sources */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Traffic Sources</SectionTitle>
          {sources.length === 0 ? (
            <p className="text-sm text-gray-400">No referral data yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label={(props: any) => `${props.source || props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}>
                    {sources.map((s: any, i: number) => (
                      <Cell key={i} fill={SOURCE_COLORS[s.source] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v.toLocaleString(), "Visits"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-0.5 mt-2">
                {sources.map((s: any, i: number) => (
                  <BreakdownRow key={s.source} label={s.source} count={s.count} total={totalSources}
                    color={SOURCE_COLORS[s.source] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Countries */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Top Countries</SectionTitle>
          {countries.length === 0 ? (
            <p className="text-sm text-gray-400">No geo data yet. Geo data appears after visitors are tracked.</p>
          ) : (
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {countries.map((c: any, i: number) => (
                <BreakdownRow key={c.country} label={c.country} count={c.count} total={totalCountries}
                  color={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Yearly stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
        <SectionTitle>Yearly Overview</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-2xl font-bold text-amber-700">{(s.yearVisits ?? 0).toLocaleString()}</p>
            <p className="text-xs text-amber-600 mt-1">This Year</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-2xl font-bold text-blue-700">{(s.monthVisits ?? 0).toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-1">This Month</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <p className="text-2xl font-bold text-green-700">{(s.totalUnique ?? 0).toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">Total Unique Visitors</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 pb-4">
        Analytics data auto-refreshes every 30 seconds · Bots and crawlers are automatically excluded
      </p>
    </AdminLayout>
  );
}
