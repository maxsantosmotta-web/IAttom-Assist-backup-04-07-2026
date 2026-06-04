import { useState, useEffect } from "react";
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
  "Campaign": "Campanha",
  "Content": "Conteúdo",
  "Creative": "Criativos",
  "Video Script": "Roteiro de Vídeo",
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Start",
  start: "Start",
  pro: "Pro",
  business: "Completo",
  completo: "Completo",
  premium: "Premium",
  agency: "Pro",
};

const PLAN_MRR_LABEL: Record<string, string> = {
  free: "MRR Start",
  start: "MRR Start",
  Start: "MRR Start",
  pro: "MRR Pro",
  Pro: "MRR Pro",
  business: "MRR Completo",
  completo: "MRR Completo",
  Completo: "MRR Completo",
  premium: "MRR Premium",
  Premium: "MRR Premium",
  agency: "MRR Pro",
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  let x: number;
  let y: number;
  if (percent >= 0.99) {
    x = cx;
    y = cy;
  } else {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    x = cx + radius * Math.cos(-midAngle * RADIAN);
    y = cy + radius * Math.sin(-midAngle * RADIAN);
  }
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
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

function StatTile({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-4">
      <Icon className={`w-4 h-4 ${color} mb-3`} />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-700 mt-0.5">{sub}</p>}
    </div>
  );
}

export function AdminAnalytics() {
  const { data: analytics, isLoading, refetch: refetchAnalytics } = useGetAdminAnalytics();
  const { getToken } = useAuth();
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthTick, setGrowthTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/admin/growth-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setGrowthStats(await res.json());
      } finally {
        setGrowthLoading(false);
      }
    })();
  }, [growthTick, getToken]);

  const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({
    ...f,
    name: FEATURE_NAME_MAP[f.name] ?? f.name,
    fill: FEATURE_COLORS[i % FEATURE_COLORS.length],
  }));

  const FIXED_PLAN_ORDER = [
    { plan: "Start", key: "free" },
    { plan: "Completo", key: "business" },
    { plan: "Premium", key: "premium" },
    { plan: "Pro", key: "pro" },
  ];
  const planRevenueDisplay = FIXED_PLAN_ORDER.map(({ plan, key }) => {
    const found = (analytics?.planRevenue ?? []).find(
      (p) => p.plan?.toLowerCase() === key
    );
    return { plan, mrr: found?.mrr ?? 0, users: found?.users ?? 0 };
  });
  const revenueData = planRevenueDisplay;

  const hasPaidSubscribers = (growthStats?.activeSubscribers ?? 0) > 0;
  const planBar = (growthStats && hasPaidSubscribers)
    ? [
        { name: "START",    users: growthStats.planBreakdown.free,     fill: "#60a5fa" },
        { name: "COMPLETO", users: growthStats.planBreakdown.pro,      fill: "#34d399" },
        { name: "PREMIUM",  users: growthStats.planBreakdown.business, fill: "#a78bfa" },
        { name: "PRO",      users: growthStats.planBreakdown.agency,   fill: "#C9A84C" },
      ].filter((p) => p.users > 0)
    : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Análises</h2>
            <p className="text-muted-foreground text-sm">Crescimento, receita, ativação e análise de cancelamentos.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { void refetchAnalytics(); setGrowthTick((t) => t + 1); }} disabled={isLoading || growthLoading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || growthLoading) ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* Revenue & Growth KPIs */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Receita e Crescimento</p>
        {growthLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-xl skeleton-shimmer" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Receita Recorrente Mensal" value={`$${growthStats?.mrr?.toLocaleString() ?? 0}`} icon={DollarSign} color="text-primary" />
            <StatTile label="Assinantes Pagos" value={(growthStats?.activeSubscribers ?? 0).toString()} sub={`de ${growthStats?.totalUsers ?? 0} usuários no total`} icon={Users} color="text-emerald-400" />
            <StatTile label="Taxa de Conversão" value={`${growthStats?.conversionRate ?? 0}%`} sub="Gratuito → Pago" icon={TrendingUp} color="text-amber-400" />
            <StatTile label="Taxa de Ativação" value={`${growthStats?.activationRate ?? 0}%`} sub={`${growthStats?.activatedCount ?? 0} usuários usaram IA`} icon={Activity} color="text-blue-400" />
          </div>
        )}
      </motion.div>

      {/* Secondary KPIs */}
      {!growthLoading && growthStats && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Novos Usuários (Semana)" value={(growthStats.newUsersThisWeek).toString()} icon={Users} color="text-purple-400" />
            <StatTile label="Novos Usuários (Mês)" value={(growthStats.newUsersThisMonth).toString()} icon={TrendingUp} color="text-rose-400" />
            <StatTile label="Códigos de Indicação Ativos" value={(growthStats.totalReferralCodes).toString()} sub={`${growthStats.totalReferralUses} usos`} icon={GitBranch} color="text-primary" />
            <StatTile label="Créditos Gastos (30d)" value={(growthStats.creditsSpentThisMonth).toLocaleString()} icon={Zap} color="text-amber-400" />
          </div>
        </motion.div>
      )}

      {/* Churn Risk */}
      {!growthLoading && growthStats && growthStats.churnRisk.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="bg-[#111111] border-amber-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Risco de Churn — Usuários Pagos com Créditos Baixos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 mb-3">Assinantes pagos com menos de 15% de créditos restantes neste período de cobrança.</p>
              <div className="space-y-2">
                {growthStats.churnRisk.map((u) => (
                  <div key={u.clerkId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-zinc-400 truncate">{u.clerkId}</p>
                    </div>
                    <Badge className={`text-[10px] px-2 capitalize ${
                      u.plan === "pro" ? "bg-primary/10 text-primary border-primary/20" :
                      u.plan === "business" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    }`}>{u.plan}</Badge>
                    <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${u.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-red-400 font-semibold w-8 text-right">{u.pct}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Plan Distribution — always rendered when loaded */}
      {!growthLoading && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Distribuição de Planos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {planBar.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                    <Users className="w-5 h-5 text-white/[0.15]" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500 mb-1.5">Nenhuma distribuição de planos ainda.</p>
                  <p className="text-xs text-zinc-700 max-w-xs leading-relaxed">As assinaturas aparecerão aqui conforme os usuários escolherem seus planos.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={planBar}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    style={{ background: "transparent" }}
                    barCategoryGap="40%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="users" name="Usuários" radius={[4, 4, 0, 0]} maxBarSize={52}>
                      {planBar.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.9} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* User & Project Growth */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Crescimento de Usuários e Projetos (7 Meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analytics?.userGrowth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradUsers2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProjects2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users" stroke={GOLD} strokeWidth={2.5} fill="url(#gradUsers2)" name="Usuários" dot={{ fill: GOLD, r: 3 }} />
                  <Area type="monotone" dataKey="projects" stroke={PURPLE} strokeWidth={2} fill="url(#gradProjects2)" name="Projetos" dot={{ fill: PURPLE, r: 3 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Uso por Recurso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-52 w-full bg-white/5 rounded-lg" />
              ) : !featureData.length ? (
                <p className="text-sm text-muted-foreground text-center py-10">Sem dados de uso ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 30, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} width={90} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Ações" radius={[0, 4, 4, 0]}>
                      {featureData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-primary" /> Receita por Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-52 w-full bg-white/5 rounded-lg" />
              ) : revenueData.length === 0 || revenueData.every((p) => p.mrr === 0) ? (
                <div className="flex flex-col items-center justify-center h-52">
                  <p className="text-sm text-muted-foreground">Nenhum assinante pago ainda.</p>
                  <p className="text-xs text-muted-foreground mt-1">Faça upgrade de usuários para ver a receita aqui.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={planRevenueDisplay} dataKey="mrr" nameKey="plan" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={<PieLabel />}>
                        {planRevenueDisplay.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {planRevenueDisplay.map((p, i) => (
                      <div key={p.plan} className="text-center">
                        <p className="text-sm font-bold" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>${p.mrr.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{PLAN_MRR_LABEL[p.plan] ?? `${p.plan} MRR`}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {!isLoading && analytics && analytics.featureUsage.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" /> Resumo de Uso dos Recursos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {featureData.map((feature) => (
                  <div key={feature.name} className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground w-36 shrink-0 truncate">{feature.name}</p>
                    <div className="flex-1 bg-white/5 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${feature.percentage}%`, backgroundColor: feature.fill }} />
                    </div>
                    <p className="text-xs font-semibold text-white w-10 text-right shrink-0">{feature.percentage}%</p>
                    <p className="text-xs text-muted-foreground w-14 text-right shrink-0">{feature.count} usos</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
