import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart2, PieChart as PieIcon, Zap, Users, DollarSign, Activity, AlertTriangle, GitBranch, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useGetAdminAnalytics } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";

const GOLD = "#C9A84C";
const PURPLE = "#a78bfa";
const EMERALD = "#34d399";
const BLUE = "#60a5fa";
const ORANGE = "#fb923c";
const ROSE = "#fb7185";
const AMBER = "#fbbf24";

const PIE_COLORS = [GOLD, PURPLE, EMERALD, BLUE];
const FEATURE_COLORS = [GOLD, PURPLE, EMERALD, BLUE, ORANGE, ROSE, AMBER];
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-1 font-medium">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {typeof p.value === "number" && p.value >= 1000 ? `$${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
};

const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery": "Descoberta de Produtos",
  "Product Validation": "Validação de Produtos",
  "Validate Products": "Validar Produtos",
  Campaign: "Campanha",
  Content: "Conteúdo",
  Creative: "Criativos",
  "Video Script": "Roteiro de Vídeo",
  campaign: "Campanha",
  campaign_creation: "Criar Campanha",
  content: "Conteúdo",
  content_creation: "Criar Conteúdo",
  creative: "Criativo",
  creative_generator: "Gerar Criativo",
  video_script: "Script de Vídeo",
  product_discovery: "Descoberta de Produto",
  product_validation: "Validação de Produto",
  marketing: "Marketing",
};

const PLAN_MRR_LABEL: Record<string, string> = {
  free: "MRR Start", start: "MRR Start", Start: "MRR Start",
  pro: "MRR Pro", Pro: "MRR Pro",
  business: "MRR Completo", completo: "MRR Completo", Completo: "MRR Completo",
  premium: "MRR Premium", Premium: "MRR Premium", agency: "MRR Pro",
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = percent >= 0.99 ? 0 : innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = percent >= 0.99 ? cx : cx + radius * Math.cos(-midAngle * RADIAN);
  const y = percent >= 0.99 ? cy : cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
};

interface CreditAnalytics {
  byFeature: Array<{ feature: string | null; total: number; ops: number }>;
  byDay: Array<{ day: string; total: number }>;
  byPlan: Array<{ plan: string; total: number; userCount: number }>;
  days: number;
}

const FEATURE_PT: Record<string, string> = {
  campaign_creation: "Criar Campanha",
  creative_generator: "Gerar Criativo",
  content_creation: "Criar Conteúdo",
  video_script: "Script de Vídeo",
  product_discovery: "Descoberta de Produto",
  product_validation: "Validação de Produto",
  marketing: "Marketing",
  prompt: "Prompt",
};

const PLAN_PT_SHORT: Record<string, string> = {
  free: "Gratuito", pro: "Pro", business: "Completo", agency: "Agência",
};

interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
  activatedCount: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  churnRisk: Array<{ clerkId: string; plan: string; credits: number; planLimit: number; pct: number }>;
  totalReferralCodes: number;
  totalReferralUses: number;
  creditsSpentThisMonth: number;
  planBreakdown: { free: number; pro: number; business: number; agency: number };
}

function StatTile({ label, value, sub, icon: Icon, color, glow }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string; glow: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]"
      style={{ backgroundImage: `radial-gradient(circle at 18% 16%, ${glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)` }}
    >
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-700">{sub}</p>}
    </div>
  );
}

function LivePulse() {
  return (
    <span className="ml-auto flex items-center gap-1.5 text-[9px] font-medium text-emerald-300/75">
      <span className="relative flex h-2 w-2">
        <motion.span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" animate={{ scale: [1, 2.1, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 2, repeat: Infinity }} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      ao vivo
    </span>
  );
}

function LiveCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`relative overflow-hidden border-white/[0.06] bg-[#0d0f13] ${className}`}>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[-35%] w-[30%] bg-gradient-to-r from-transparent via-white/[0.025] to-transparent"
        animate={{ x: ["0%", "460%"] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative z-[1]">{children}</div>
    </Card>
  );
}

export function AdminAnalytics() {
  const { data: analytics, isLoading, isFetching: fetchingAnalytics, refetch: refetchAnalytics } = useGetAdminAnalytics();
  const { getToken } = useAuth();
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthTick, setGrowthTick] = useState(0);
  const [creditsData, setCreditsData] = useState<CreditAnalytics | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetchAnalytics();
      setGrowthTick((tick) => tick + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refetchAnalytics]);

  useEffect(() => {
    setGrowthLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/admin/growth-stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setGrowthStats(await res.json());
      } finally {
        setGrowthLoading(false);
      }
    })();
  }, [growthTick, getToken]);

  useEffect(() => {
    setCreditsLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/admin/credits-analytics`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setCreditsData(await res.json() as CreditAnalytics);
      } finally {
        setCreditsLoading(false);
      }
    })();
  }, [growthTick, getToken]);

  const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({ ...f, name: FEATURE_NAME_MAP[f.name] ?? f.name, fill: FEATURE_COLORS[i % FEATURE_COLORS.length] }));
  const fixedPlanOrder = [
    { plan: "Start", key: "free" },
    { plan: "Completo", key: "business" },
    { plan: "Premium", key: "premium" },
    { plan: "Pro", key: "pro" },
  ];
  const planRevenueDisplay = fixedPlanOrder.map(({ plan, key }) => {
    const found = (analytics?.planRevenue ?? []).find((p) => p.plan?.toLowerCase() === key);
    return { plan, mrr: found?.mrr ?? 0, users: found?.users ?? 0 };
  });
  const revenueData = planRevenueDisplay;
  const hasPaidSubscribers = (growthStats?.activeSubscribers ?? 0) > 0;
  const planBar = growthStats && hasPaidSubscribers ? [
    { name: "START", users: growthStats.planBreakdown.free, fill: "#60a5fa" },
    { name: "COMPLETO", users: growthStats.planBreakdown.pro, fill: "#34d399" },
    { name: "PREMIUM", users: growthStats.planBreakdown.business, fill: "#a78bfa" },
    { name: "PRO", users: growthStats.planBreakdown.agency, fill: "#C9A84C" },
  ].filter((p) => p.users > 0) : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-white">Análises</h2>
            <p className="text-sm text-muted-foreground">Crescimento, receita, ativação e análise de cancelamentos.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { void refetchAnalytics(); setGrowthTick((t) => t + 1); }} disabled={fetchingAnalytics || growthLoading} className="mt-1 shrink-0 gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${(fetchingAnalytics || growthLoading) ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Receita e Crescimento</p>
        {growthLoading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-xl skeleton-shimmer" />)}</div> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Receita Recorrente Mensal" value={`$${growthStats?.mrr?.toLocaleString() ?? 0}`} icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.11)" />
            <StatTile label="Assinantes Pagos" value={(growthStats?.activeSubscribers ?? 0).toString()} sub={`de ${growthStats?.totalUsers ?? 0} usuários no total`} icon={Users} color="text-emerald-300" glow="rgba(16,185,129,.10)" />
            <StatTile label="Taxa de Conversão" value={`${growthStats?.conversionRate ?? 0}%`} sub="Gratuito → Pago" icon={TrendingUp} color="text-amber-300" glow="rgba(245,180,35,.10)" />
            <StatTile label="Taxa de Ativação" value={`${growthStats?.activationRate ?? 0}%`} sub={`${growthStats?.activatedCount ?? 0} usuários usaram IA`} icon={Activity} color="text-cyan-300" glow="rgba(34,211,238,.10)" />
          </div>
        )}
      </motion.div>

      {!growthLoading && growthStats && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Novos Usuários (Semana)" value={growthStats.newUsersThisWeek.toString()} icon={Users} color="text-violet-300" glow="rgba(139,92,246,.10)" />
            <StatTile label="Novos Usuários (Mês)" value={growthStats.newUsersThisMonth.toString()} icon={TrendingUp} color="text-rose-300" glow="rgba(244,63,94,.09)" />
            <StatTile label="Códigos de Indicação Ativos" value={growthStats.totalReferralCodes.toString()} sub={`${growthStats.totalReferralUses} usos`} icon={GitBranch} color="text-amber-300" glow="rgba(245,180,35,.10)" />
            <StatTile label="Créditos Gastos (30d)" value={growthStats.creditsSpentThisMonth.toLocaleString()} icon={Zap} color="text-amber-300" glow="rgba(245,180,35,.10)" />
          </div>
        </motion.div>
      )}

      {!growthLoading && growthStats && growthStats.churnRisk.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="border-amber-500/15 bg-[#111111]">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><AlertTriangle className="h-4 w-4 text-amber-400" /> Risco de Churn — Usuários Pagos com Créditos Baixos</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-zinc-500">Assinantes pagos com menos de 15% de créditos restantes neste período de cobrança.</p>
              <div className="space-y-2">{growthStats.churnRisk.map((u) => (
                <div key={u.clerkId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-zinc-400">{u.clerkId}</p></div>
                  <Badge className={`px-2 text-[10px] capitalize ${u.plan === "pro" ? "border-primary/20 bg-primary/10 text-primary" : u.plan === "business" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-purple-500/20 bg-purple-500/10 text-purple-400"}`}>{PLAN_PT_SHORT[u.plan] ?? u.plan}</Badge>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-red-400" style={{ width: `${u.pct}%` }} /></div>
                  <span className="w-8 text-right text-[10px] font-semibold text-red-400">{u.pct}%</span>
                </div>
              ))}</div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!growthLoading && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          <Card className="border-white/5 bg-[#111111]">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-primary" /> Distribuição de Planos</CardTitle></CardHeader>
            <CardContent>{planBar.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.03]"><Users className="h-5 w-5 text-white/[0.15]" /></div><p className="mb-1.5 text-sm font-medium text-zinc-500">Nenhuma distribuição de planos ainda.</p><p className="max-w-xs text-xs leading-relaxed text-zinc-700">As assinaturas aparecerão aqui conforme os usuários escolherem seus planos.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={160}><BarChart data={planBar} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="40%"><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} /><Bar dataKey="users" name="Usuários" radius={[4,4,0,0]} maxBarSize={52}>{planBar.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.9} />)}</Bar></BarChart></ResponsiveContainer>
            )}</CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="border-white/5 bg-[#111111]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp className="h-4 w-4 text-primary" /> Crescimento de Usuários e Projetos (7 Meses)</CardTitle></CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-48 w-full rounded-lg bg-white/5" /> : (
            <ResponsiveContainer width="100%" height={200}><AreaChart data={analytics?.userGrowth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="gradUsers2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.35} /><stop offset="95%" stopColor={GOLD} stopOpacity={0} /></linearGradient><linearGradient id="gradProjects2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} /><stop offset="95%" stopColor={PURPLE} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="users" stroke={GOLD} strokeWidth={2.5} fill="url(#gradUsers2)" name="Usuários" dot={{ fill: GOLD, r: 3 }} /><Area type="monotone" dataKey="projects" stroke={PURPLE} strokeWidth={2} fill="url(#gradProjects2)" name="Projetos" dot={{ fill: PURPLE, r: 3 }} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }} /></AreaChart></ResponsiveContainer>
          )}</CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
          <LiveCard className="h-full"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Zap className="h-4 w-4 text-primary" /> Uso por Recurso <LivePulse /></CardTitle></CardHeader><CardContent>{isLoading ? <Skeleton className="h-52 w-full rounded-lg bg-white/5" /> : !featureData.length ? <p className="py-10 text-center text-sm text-muted-foreground">Sem dados de uso ainda.</p> : <ResponsiveContainer width="100%" height={220}><BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 30, left: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} width={90} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="count" name="Ações" radius={[0,4,4,0]}>{featureData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer>}</CardContent></LiveCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <LiveCard className="h-full"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><PieIcon className="h-4 w-4 text-primary" /> Receita por Plano <LivePulse /></CardTitle></CardHeader><CardContent>{isLoading ? <Skeleton className="h-52 w-full rounded-lg bg-white/5" /> : revenueData.length === 0 || revenueData.every((p) => p.mrr === 0) ? <div className="flex h-52 flex-col items-center justify-center"><p className="text-sm text-muted-foreground">Nenhum assinante pago ainda.</p><p className="mt-1 text-xs text-muted-foreground">Faça upgrade de usuários para ver a receita aqui.</p></div> : <><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={planRevenueDisplay} dataKey="mrr" nameKey="plan" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={<PieLabel />}>{planRevenueDisplay.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}</Pie><Tooltip content={<CustomTooltip />} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a" }} /></PieChart></ResponsiveContainer><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{planRevenueDisplay.map((p, i) => <div key={p.plan} className="text-center"><p className="text-sm font-bold" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>${p.mrr.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{PLAN_MRR_LABEL[p.plan] ?? `${p.plan} MRR`}</p></div>)}</div></>}</CardContent></LiveCard>
        </motion.div>
      </div>

      {!isLoading && analytics && analytics.featureUsage.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <LiveCard><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart2 className="h-4 w-4 text-primary" /> Resumo de Uso dos Recursos <LivePulse /></CardTitle></CardHeader><CardContent><div className="space-y-2.5">{featureData.map((feature) => <div key={feature.name} className="flex items-center gap-3"><p className="w-36 shrink-0 truncate text-xs text-muted-foreground">{feature.name}</p><div className="h-2 flex-1 rounded-full bg-white/5"><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${feature.percentage}%`, backgroundColor: feature.fill }} /></div><p className="w-10 shrink-0 text-right text-xs font-semibold text-white">{feature.percentage}%</p><p className="w-14 shrink-0 text-right text-xs text-muted-foreground">{feature.count} usos</p></div>)}</div></CardContent></LiveCard>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.28 }}><p className="text-[10px] font-medium uppercase tracking-widest text-primary">Análise de Créditos</p><h3 className="mt-0.5 text-base font-semibold text-white">Consumo dos últimos {creditsData?.days ?? 30} dias</h3></motion.div>

      {creditsLoading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Skeleton className="h-52 rounded-xl bg-white/5" /><Skeleton className="h-52 rounded-xl bg-white/5" /><Skeleton className="col-span-full h-40 rounded-xl bg-white/5" /></div> : !creditsData || (creditsData.byFeature.length === 0 && creditsData.byDay.length === 0) ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}><Card className="border-white/5 bg-[#111111]"><CardContent className="flex h-28 items-center justify-center"><p className="text-xs text-muted-foreground">Nenhum consumo de créditos registrado nesse período.</p></CardContent></Card></motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {creditsData.byFeature.length > 0 && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}><Card className="h-full border-white/5 bg-[#111111]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Zap className="h-4 w-4 text-primary" /> Consumo por Módulo</CardTitle></CardHeader><CardContent><div className="space-y-2.5">{creditsData.byFeature.map((f, i) => { const label = FEATURE_PT[f.feature ?? ""] ?? f.feature ?? "Desconhecido"; const maxTotal = creditsData.byFeature[0]?.total ?? 1; const pct = Math.round((f.total / maxTotal) * 100); return <div key={f.feature ?? i} className="flex items-center gap-3"><p className="w-36 shrink-0 truncate text-xs text-muted-foreground">{label}</p><div className="h-2 flex-1 rounded-full bg-white/5"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: FEATURE_COLORS[i % FEATURE_COLORS.length] }} /></div><p className="w-12 shrink-0 text-right text-xs font-semibold text-white">{f.total.toLocaleString("pt-BR")}</p><p className="w-12 shrink-0 text-right text-xs text-muted-foreground">{f.ops} ops</p></div>; })}</div></CardContent></Card></motion.div>}
            {creditsData.byPlan.length > 0 && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.32 }}><Card className="h-full border-white/5 bg-[#111111]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-primary" /> Consumo por Plano</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={180}><BarChart data={creditsData.byPlan.map((p) => ({ ...p, planLabel: PLAN_PT_SHORT[p.plan] ?? p.plan }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} /><XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} /><YAxis type="category" dataKey="planLabel" tick={{ fill: "#71717a", fontSize: 11 }} width={80} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="total" name="Créditos" radius={[0,4,4,0]}>{creditsData.byPlan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer><div className="mt-2 grid grid-cols-2 gap-2">{creditsData.byPlan.map((p, i) => <div key={p.plan} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate text-zinc-400">{PLAN_PT_SHORT[p.plan] ?? p.plan}</span><span className="ml-auto text-zinc-600">{p.userCount} usr</span></div>)}</div></CardContent></Card></motion.div>}
          </div>
          {creditsData.byDay.length > 0 && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.34 }}><Card className="border-white/5 bg-[#111111]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-primary" /> Consumo Diário de Créditos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={180}><AreaChart data={creditsData.byDay.map((d) => ({ ...d, dayLabel: new Date(d.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}><defs><linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="95%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="dayLabel" tick={{ fill: "#71717a", fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fill: "#71717a", fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="total" name="Créditos" stroke={GOLD} strokeWidth={2} fill="url(#credGrad)" dot={false} /></AreaChart></ResponsiveContainer></CardContent></Card></motion.div>}
        </>
      )}
    </div>
  );
}
