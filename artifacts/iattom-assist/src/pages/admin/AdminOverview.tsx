import { motion } from "framer-motion";
import { Users, FolderOpen, Zap, DollarSign, TrendingUp, TrendingDown, UserPlus, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGetAdminStats, useGetAdminAnalytics, useListAdminActivity } from "@workspace/api-client-react";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const MUTED = "#3f3f46";

const moduleColors: Record<string, string> = {
  campaign: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  content: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  creative: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  video_script: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  product_discovery: "text-primary bg-primary/10 border-primary/20",
  product_validation: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function AdminOverview() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: analytics, isLoading: analyticsLoading } = useGetAdminAnalytics();
  const { data: activity, isLoading: activityLoading } = useListAdminActivity({ limit: 6 });

  const mrr = ((stats?.planBreakdown.pro ?? 0) * 79) + ((stats?.planBreakdown.business ?? 0) * 199) + ((stats?.planBreakdown.agency ?? 0) * 499);

  const statCards = [
    {
      label: "Total Users",
      value: statsLoading ? null : stats?.totalUsers ?? 0,
      icon: Users,
      sub: `+${stats?.newUsersThisMonth ?? 0} this month`,
      color: "text-blue-400",
      bg: "bg-blue-400/10 border-blue-400/20",
    },
    {
      label: "Total Projects",
      value: statsLoading ? null : stats?.totalProjects ?? 0,
      icon: FolderOpen,
      sub: `+${stats?.newProjectsThisMonth ?? 0} this month`,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
    },
    {
      label: "AI Actions",
      value: statsLoading ? null : stats?.totalActions ?? 0,
      icon: Zap,
      sub: "Total across all users",
      color: "text-purple-400",
      bg: "bg-purple-400/10 border-purple-400/20",
    },
    {
      label: "Monthly Revenue",
      value: statsLoading ? null : `$${mrr.toLocaleString()}`,
      icon: DollarSign,
      sub: `${(stats?.planBreakdown.pro ?? 0) + (stats?.planBreakdown.business ?? 0)} paid users`,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    },
  ];

  const planBar = analytics ? [
    { name: "Cristal", users: analytics.planRevenue.find(p => p.plan === "free")?.users ?? 0, fill: "#bae6fd" },
    { name: "Rubi", users: analytics.planRevenue.find(p => p.plan === "pro")?.users ?? 0, fill: "#fb7185" },
    { name: "Esmeralda", users: analytics.planRevenue.find(p => p.plan === "business")?.users ?? 0, fill: GOLD_LIGHT },
    { name: "Diamante", users: analytics.planRevenue.find(p => p.plan === "agency")?.users ?? 0, fill: "#e2e8f0" },
  ] : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Admin Panel</p>
        <h2 className="text-2xl font-bold text-white mb-1">Platform Overview</h2>
        <p className="text-muted-foreground text-sm">Real-time platform health across all users and subscriptions.</p>
      </motion.div>

      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} variants={itemVariants}>
              <Card className="bg-[#111111] border-white/5 hover:border-white/10 transition-colors">
                <CardContent className="p-5">
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${card.bg}`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  {card.value === null ? (
                    <Skeleton className="h-8 w-20 bg-white/5 mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white mb-0.5">{card.value}</p>
                  )}
                  <p className="text-xs font-semibold text-white mb-0.5">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> User & Project Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics?.userGrowth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProjects" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="users" stroke={GOLD} strokeWidth={2} fill="url(#gradUsers)" name="Users" dot={false} />
                    <Area type="monotone" dataKey="projects" stroke="#a78bfa" strokeWidth={2} fill="url(#gradProjects)" name="Projects" dot={false} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Plan Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={planBar} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="users" name="Users" radius={[4, 4, 0, 0]}>
                      {planBar.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Recent Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : !activity?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((item) => {
                  const colorClass = moduleColors[item.module] ?? "text-muted-foreground bg-white/5 border-white/10";
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${colorClass}`}>
                        {item.module.replace("_", " ")}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.action}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.userEmail ?? "Unknown user"}{item.projectName ? ` · ${item.projectName}` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">{timeAgo(item.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
