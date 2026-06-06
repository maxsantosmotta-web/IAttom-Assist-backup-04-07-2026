import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, Zap, DollarSign, TrendingUp, Layers,
  RefreshCw, Activity, Percent, CreditCard, UserCheck, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  useGetAdminStats, useGetAdminAnalytics,
  useListAdminActivity,
  getGetAdminStatsQueryKey, getGetAdminAnalyticsQueryKey, getListAdminActivityQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
/**
 * Normalizes a raw action string to a canonical PT-BR category.
 * Strips project-name suffixes (after ":") before pattern-matching.
 */
function normalizeAction(action: string): string {
  const base = action.split(":")[0].trim();
  if (/campaign.*creat|creat.*campaign|campanha.*cria/i.test(base))  return "Campanhas Criadas";
  if (/campaign.*refin|block.*refin|bloco/i.test(base))              return "Blocos Refinados";
  if (/content.*creat|creat.*content|content.*gen|gen.*content|conteúdo/i.test(base)) return "Conteúdos Criados";
  if (/script.*creat|script.*gen|video.?script/i.test(base))         return "Scripts Gerados";
  if (/creative.*gen|gen.*creative|criativo/i.test(base))            return "Criativos Gerados";
  if (/creat.*project|project.*creat|projeto.*cri/i.test(base))      return "Projetos Criados";
  if (/updat.*project|project.*updat|projeto.*atualiz/i.test(base))  return "Projetos Atualizados";
  if (/complet.*project|project.*complet|projeto.*conclu/i.test(base)) return "Projetos Concluídos";
  if (/validat|validação/i.test(base))                               return "Validações Executadas";
  if (/discover|descoberta/i.test(base))                             return "Descobertas Executadas";
  if (/marketing/i.test(base))                                       return "Marketing Gerado";
  if (/prompt/i.test(base))                                          return "Prompts Criados";
  if (/delet|exclu/i.test(base))                                     return "Itens Excluídos";
  if (/restor|restaur/i.test(base))                                  return "Itens Restaurados";
  return base.length > 0 ? base : action;
}

/* ─── palette ────────────────────────────────────────────────────── */
const GOLD    = "#C9A84C";
const PURPLE  = "#a78bfa";
const EMERALD = "#34d399";
const BLUE    = "#60a5fa";
const ORANGE  = "#fb923c";
const ROSE    = "#fb7185";
const AMBER   = "#fbbf24";
const CYAN    = "#22d3ee";

const FEATURE_COLORS  = [GOLD, PURPLE, EMERALD, BLUE, ORANGE, ROSE, AMBER];
const FALLBACK_COLORS = [GOLD, BLUE, PURPLE, EMERALD, ROSE, ORANGE, AMBER, CYAN];

const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery":  "Descoberta",
  "Product Validation": "Validação",
  "Validate Products":  "Validação",
  "Campaign":           "Campanha",
  "Content":            "Conteúdo",
  "Creative":           "Criativo",
  "Video Script":       "Script de Vídeo",
  "Marketing":          "Marketing",
};

const PLAN_COLORS: Record<string, string> = {
  START:    BLUE,
  COMPLETO: EMERALD,
  PREMIUM:  PURPLE,
  PRO:      GOLD,
};

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

/* ─── types ──────────────────────────────────────────────────────── */
interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  creditsSpentThisMonth: number;
  churnRisk: Array<{ clerkId: string; plan: string; credits: number; planLimit: number; pct: number }>;
  planBreakdown: { free: number; pro: number; business: number; agency: number };
}

/* ─── helpers ────────────────────────────────────────────────────── */
const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? p.fill ?? GOLD }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="text-[10px] font-bold text-primary uppercase tracking-widest shrink-0">{children}</p>
      <div className="flex-1 h-px bg-primary/20" />
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | null; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="bg-[#111111] border-white/5 hover:border-white/10 transition-colors">
      <CardContent className="p-5">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {value === null
          ? <Skeleton className="h-8 w-20 bg-white/5 mb-1" />
          : <p className="text-2xl font-bold text-white mb-0.5">{value}</p>}
        <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ─── animation ─────────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

/* ─── AdminOverview ─────────────────────────────────────────────── */
export function AdminOverview() {
  const { getToken } = useAuth();

  const { data: stats, isLoading: statsLoading, isFetching: fetchingStats, refetch: refetchStats } =
    useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), staleTime: 0 } });

  const { data: analytics, isLoading: analyticsLoading, isFetching: fetchingAnalytics, refetch: refetchAnalytics } =
    useGetAdminAnalytics({ query: { queryKey: getGetAdminAnalyticsQueryKey(), staleTime: 0 } });

  const { data: activity, isLoading: activityLoading, refetch: refetchActivity } =
    useListAdminActivity(
      { limit: 100 },
      { query: { queryKey: getListAdminActivityQueryKey({ limit: 100 }), staleTime: 0 } },
    );

  const [growthStats, setGrowthStats]     = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthTick, setGrowthTick]       = useState(0);

  useEffect(() => {
    setGrowthLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/api/admin/growth-stats`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.ok) setGrowthStats(await res.json() as GrowthStats);
      } finally { setGrowthLoading(false); }
    })();
  }, [growthTick, getToken]);

  const isRefreshing = fetchingStats || fetchingAnalytics || growthLoading;

  const handleRefresh = () => {
    void refetchStats();
    void refetchAnalytics();
    void refetchActivity();
    setGrowthTick((t) => t + 1);
  };

  /* ── USUÁRIOS: Distribuição de planos ───────────────────────── */
  const planBar = growthStats
    ? [
        { name: "START",    users: growthStats.planBreakdown.free,     fill: PLAN_COLORS.START },
        { name: "COMPLETO", users: growthStats.planBreakdown.pro,      fill: PLAN_COLORS.COMPLETO },
        { name: "PREMIUM",  users: growthStats.planBreakdown.business, fill: PLAN_COLORS.PREMIUM },
        { name: "PRO",      users: growthStats.planBreakdown.agency,   fill: PLAN_COLORS.PRO },
      ].filter((p) => p.users > 0)
    : (analytics
        ? [
            { name: "START",    users: analytics.planRevenue.find(p => p.plan === "free")?.users     ?? 0, fill: PLAN_COLORS.START },
            { name: "COMPLETO", users: analytics.planRevenue.find(p => p.plan === "pro")?.users      ?? 0, fill: PLAN_COLORS.COMPLETO },
            { name: "PREMIUM",  users: analytics.planRevenue.find(p => p.plan === "business")?.users ?? 0, fill: PLAN_COLORS.PREMIUM },
            { name: "PRO",      users: analytics.planRevenue.find(p => p.plan === "agency")?.users   ?? 0, fill: PLAN_COLORS.PRO },
          ].filter((p) => p.users > 0)
        : []);

  /* ── ANÁLISES: Uso por módulo ───────────────────────────────── */
  const featureData = (analytics?.featureUsage ?? [])
    .slice(0, 7)
    .map((f, i) => ({
      name:  FEATURE_NAME_MAP[f.name] ?? f.name,
      count: f.count,
      fill:  FEATURE_COLORS[i % FEATURE_COLORS.length],
    }));

  /* ── ATIVIDADE: Tipo de ação (from 100-item dataset) ─────────── */
  const actionChart = useMemo(() => {
    const items = activity ?? [];
    const actionMap: Record<string, number> = {};
    for (const it of items) {
      const label = normalizeAction(it.action);
      actionMap[label] = (actionMap[label] ?? 0) + 1;
    }
    return Object.entries(actionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([name, count], i) => ({
        name,
        count,
        fill: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }));
  }, [activity]);

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Painel Administrativo</p>
            <h2 className="text-2xl font-bold text-white mb-1">Visão Geral da Plataforma</h2>
            <p className="text-muted-foreground text-sm">Centro de comando — métricas, crescimento e atividade da plataforma.</p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={handleRefresh} disabled={isRefreshing}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 sm:shrink-0 sm:mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO: USUÁRIOS                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}>
        <SectionLabel>Usuários</SectionLabel>
      </motion.div>

      {/* Bloco 1: KPIs de usuários */}
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Total de Usuários"
            value={(statsLoading && !growthStats) ? null : String(growthStats?.totalUsers ?? stats?.totalUsers ?? 0)}
            sub="usuários cadastrados"
            icon={Users}
            color="text-blue-400 bg-blue-400/10 border-blue-400/20"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Novos esta Semana"
            value={growthLoading ? null : String(growthStats?.newUsersThisWeek ?? 0)}
            sub="nos últimos 7 dias"
            icon={CalendarDays}
            color="text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Novos este Mês"
            value={growthLoading ? null : String(growthStats?.newUsersThisMonth ?? stats?.newUsersThisMonth ?? 0)}
            sub="nos últimos 30 dias"
            icon={UserCheck}
            color="text-purple-400 bg-purple-400/10 border-purple-400/20"
          />
        </motion.div>
      </motion.div>

      {/* Bloco 2: Distribuição de planos + Conversão/Ativação/Pagos */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Bar: Distribuição de Planos */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="lg:col-span-2"
        >
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Distribuição de Planos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(growthLoading && !analytics) ? (
                <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
              ) : planBar.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Nenhum usuário com plano ativo.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={planBar} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="users" name="Usuários" radius={[4, 4, 0, 0]}>
                      {planBar.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Mini-tiles: Conversão + Ativação + Planos Pagos */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.19 }}
          className="flex flex-col gap-4"
        >
          {growthLoading ? (
            <>
              <Skeleton className="h-24 bg-white/5 rounded-xl" />
              <Skeleton className="h-24 bg-white/5 rounded-xl" />
              <Skeleton className="h-24 bg-white/5 rounded-xl" />
            </>
          ) : (
            <>
              <Card className="bg-[#111111] border-white/5 flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border flex items-center justify-center text-primary bg-primary/10 border-primary/20 shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{growthStats?.conversionRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Conversão</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#111111] border-white/5 flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border flex items-center justify-center text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{growthStats?.activationRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Ativação</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#111111] border-white/5 flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border flex items-center justify-center text-amber-400 bg-amber-400/10 border-amber-400/20 shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{growthStats?.activeSubscribers ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Planos Pagos</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO: ANÁLISES                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.22 }}>
        <SectionLabel>Análises</SectionLabel>
      </motion.div>

      {/* Bloco 3: KPIs de análise */}
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Execuções"
            value={statsLoading ? null : String(stats?.totalActions ?? 0)}
            sub="total entre todos os usuários"
            icon={Zap}
            color="text-purple-400 bg-purple-400/10 border-purple-400/20"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Receita Mensal"
            value={growthLoading ? null : `$${(growthStats?.mrr ?? 0).toLocaleString()}`}
            sub="MRR estimado"
            icon={DollarSign}
            color="text-primary bg-primary/10 border-primary/20"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Consumo / Mês"
            value={growthLoading ? null : String(growthStats?.creditsSpentThisMonth ?? 0)}
            sub="créditos gastos este mês"
            icon={Activity}
            color="text-orange-400 bg-orange-400/10 border-orange-400/20"
          />
        </motion.div>
      </motion.div>

      {/* Bloco 4: Crescimento de Usuários e Projetos */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
      >
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Crescimento — Usuários e Projetos
              <span className="text-[10px] text-zinc-600 font-normal ml-auto">evolução semanal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-52 w-full bg-white/5 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics?.userGrowth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovGradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GOLD}   stopOpacity={0.3} />
                      <stop offset="95%" stopColor={GOLD}   stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ovGradProjects" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users"    stroke={GOLD}   strokeWidth={2} fill="url(#ovGradUsers)"    name="Usuários" dot={false} />
                  <Area type="monotone" dataKey="projects" stroke={PURPLE} strokeWidth={2} fill="url(#ovGradProjects)" name="Projetos" dot={false} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SEÇÃO: ATIVIDADE                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.33 }}>
        <SectionLabel>Atividade</SectionLabel>
      </motion.div>

      {/* Bloco 5 + Bloco 6: Módulo + Tipo de Ação */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Bloco 5: Uso por Módulo (from analytics — server-side aggregated) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.37 }}
        >
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Uso por Módulo
                <span className="text-[10px] text-zinc-600 font-normal ml-auto">histórico completo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <Skeleton className="h-52 w-full bg-white/5 rounded-lg" />
              ) : featureData.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Nenhuma execução registrada.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, featureData.length * 36)}>
                  <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Execuções" radius={[0, 4, 4, 0]}>
                      {featureData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bloco 6: Atividade por Tipo de Ação (from activity dataset) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.42 }}
        >
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Atividade por Tipo de Ação
                <span className="text-[10px] text-zinc-600 font-normal ml-auto">últimos 100 eventos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <Skeleton className="h-52 w-full bg-white/5 rounded-lg" />
              ) : actionChart.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Sem atividade recente registrada.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, actionChart.length * 36)}>
                  <BarChart data={actionChart} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Ocorrências" radius={[0, 4, 4, 0]}>
                      {actionChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  );
}
