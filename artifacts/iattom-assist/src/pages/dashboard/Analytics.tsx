import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart2, Zap, Clock, TrendingUp, Award, Search, CheckCircle, Megaphone, FileText, Sparkles, Video } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsData {
  activityByModule: { module: string; count: number }[];
  creditsSpent: { day: string; spent: number }[];
  recentHistory: { id: number; action: string; module: string; createdAt: string }[];
  projectStats: { total: number; completed: number; inProgress: number };
  days: number;
}

const MODULE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  find_products: { label: "Find Products", color: "#C9A84C", icon: Search },
  product_discovery: { label: "Find Products", color: "#C9A84C", icon: Search },
  validate_products: { label: "Validate", color: "#34D399", icon: CheckCircle },
  product_validation: { label: "Validate", color: "#34D399", icon: CheckCircle },
  campaign: { label: "Campaign", color: "#FBBF24", icon: Megaphone },
  content: { label: "Content", color: "#60A5FA", icon: FileText },
  creative: { label: "Creative", color: "#C084FC", icon: Sparkles },
  video_script: { label: "Video Script", color: "#FB7185", icon: Video },
  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },
};

const DAYS_OPTIONS = [7, 14, 30, 90];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.10] rounded-xl p-3 shadow-xl">
      <p className="text-[10px] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value}</p>
    </div>
  );
};

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/user?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const totalAiRuns = data?.activityByModule.reduce((s, m) => s + m.count, 0) ?? 0;
  const totalCredits = data?.creditsSpent.reduce((s, m) => s + m.spent, 0) ?? 0;

  const chartModules = data?.activityByModule
    .map((m) => ({
      ...m,
      label: MODULE_META[m.module]?.label ?? m.module,
      color: MODULE_META[m.module]?.color ?? "#666",
    }))
    .sort((a, b) => b.count - a.count) ?? [];

  const creditsChart = data?.creditsSpent.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    spent: d.spent,
  })) ?? [];

  return (
    <div className="space-y-8 pb-4">
      {/* Header */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Insights</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Your Analytics</h2>
          <p className="text-sm text-zinc-500">Usage and performance across your workspace</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 ${
                days === d ? "bg-primary/20 text-primary" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
        initial="hidden" animate="show"
      >
        {[
          { label: "AI Runs", value: totalAiRuns, icon: Zap, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          { label: "Credits Used", value: totalCredits, icon: BarChart2, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
          { label: "Total Projects", value: data?.projectStats.total ?? 0, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Completed", value: data?.projectStats.completed ?? 0, icon: Award, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
        ].map((card) => (
          <motion.div key={card.label} variants={fadeUp}
            className="p-4 bg-[#0f0f0f] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-colors"
          >
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-12 bg-white/[0.04] rounded-lg mb-1" />
            ) : (
              <p className="text-2xl font-black text-white tabular-nums">{card.value.toLocaleString()}</p>
            )}
            <p className="text-xs text-zinc-600 font-medium mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Module Usage Bar Chart */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BarChart2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">AI Module Usage</p>
              <p className="text-xs text-zinc-600">Runs per module in last {days} days</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[180px] w-full bg-white/[0.03] rounded-xl" />
          ) : chartModules.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-sm text-zinc-700">No activity yet in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartModules} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartModules.map((m, i) => (
                    <Cell key={i} fill={m.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Credits Spent Over Time */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Credits Consumed</p>
              <p className="text-xs text-zinc-600">Daily usage over last {days} days</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[160px] w-full bg-white/[0.03] rounded-xl" />
          ) : creditsChart.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-sm text-zinc-700">No credits spent in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={creditsChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
                <Area type="monotone" dataKey="spent" stroke="#60A5FA" strokeWidth={2} fill="url(#credGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Recent Activity */}
      {data && data.recentHistory.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.25 }}>
          <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.07] flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <p className="text-sm font-bold text-zinc-200">Recent Activity</p>
            </div>
            <div className="space-y-2">
              {data.recentHistory.map((item) => {
                const meta = MODULE_META[item.module];
                const Icon = meta?.icon ?? Zap;
                return (
                  <div key={item.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.07]">
                      <Icon className="w-3 h-3 text-zinc-500" />
                    </div>
                    <p className="text-xs text-zinc-400 flex-1 truncate">{item.action}</p>
                    <span className="text-[10px] text-zinc-700 shrink-0">
                      {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
