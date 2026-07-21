import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarDays,
  CreditCard,
  DollarSign,
  Percent,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import {
  getGetAdminAnalyticsQueryKey,
  getGetAdminStatsQueryKey,
  getListAdminActivityQueryKey,
  useGetAdminAnalytics,
  useGetAdminStats,
  useListAdminActivity,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DomnDonutChart, DomnLineChart } from "@/components/admin/AdminDomnCharts";

const GOLD = "#C9A84C";
const PURPLE = "#a78bfa";
const EMERALD = "#34d399";
const BLUE = "#60a5fa";
const ORANGE = "#fb923c";
const ROSE = "#fb7185";
const AMBER = "#fbbf24";
const CYAN = "#22d3ee";

const FEATURE_COLORS = [GOLD, PURPLE, EMERALD, BLUE, ORANGE, ROSE, AMBER, CYAN];
const PLAN_COLORS: Record<string, string> = {
  Free: BLUE,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: GOLD,
};

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  start: "Start",
  premium: "Premium",
  pro: "Pro",
  business: "Premium",
  agency: "Pro",
};

const FEATURE_NAME_MAP: Record<string, string> = {
  "Product Discovery": "Descoberta de Produtos",
  "Product Validation": "Validação de Produtos",
  "Validate Products": "Validação de Produtos",
  Campaign: "Campanha",
  Content: "Conteúdo",
  Creative: "Criativos",
  "Video Script": "Roteiro de Vídeo",
  Marketing: "Marketing",
};

interface SubscriptionRow {
  id: number;
  clerkId: string;
  email: string;
  name: string | null;
  plan: string;
  stripeSubscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  creditsSpentThisMonth: number;
  planBreakdown: {
    free: number;
    start?: number;
    premium?: number;
    pro: number;
    business: number;
    agency: number;
  };
}

function normalizeAction(action: string): string {
  const base = action.split(":")[0].trim();
  if (/creative|criativo/i.test(base)) return "Criativos Gerados";
  if (/discover|descoberta/i.test(base)) return "Descobertas Executadas";
  if (/script/i.test(base)) return "Scripts Criados";
  if (/content|conteúdo/i.test(base)) return "Conteúdos Criados";
  if (/campaign|campanha/i.test(base)) return "Campanhas Criadas";
  if (/validat|validação/i.test(base)) return "Validações Executadas";
  if (/prompt/i.test(base)) return "Prompts Criados";
  return base || action;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary">{children}</p>
      <div className="h-px flex-1 bg-primary/20" />
    </div>
  );
}

function PremiumMetric({
  label,
  value,
  sub,
  icon: Icon,
  color,
  glow,
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  glow: string;
  loading?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]"
      style={{
        backgroundImage: `radial-gradient(circle at 18% 16%, ${glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)`,
      }}
    >
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      {loading ? <Skeleton className="mb-2 h-7 w-20 bg-white/5" /> : <p className="text-2xl font-bold text-white">{value}</p>}
      <p className="mt-0.5 text-xs font-semibold text-white">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function CompactMetric({ label, value, icon: Icon, color, glow }: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  glow: string;
}) {
  return (
    <div
      className="flex min-h-20 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1015] p-4"
      style={{ backgroundImage: `radial-gradient(circle at 12% 30%, ${glow}, transparent 46%)` }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const { getToken } = useAuth();

  const { data: stats, isLoading: statsLoading, isFetching: fetchingStats, refetch: refetchStats } =
    useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), staleTime: 0 } });
  const { data: analytics, isLoading: analyticsLoading, isFetching: fetchingAnalytics, refetch: refetchAnalytics } =
    useGetAdminAnalytics({ query: { queryKey: getGetAdminAnalyticsQueryKey(), staleTime: 0 } });
  const { data: activity, refetch: refetchActivity } = useListAdminActivity(
    { limit: 100 },
    { query: { queryKey: getListAdminActivityQueryKey({ limit: 100 }), staleTime: 0 } },
  );

  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthTick, setGrowthTick] = useState(0);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  useEffect(() => {
    setGrowthLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${BASE}/api/admin/growth-stats`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (response.ok) setGrowthStats(await response.json() as GrowthStats);
      } finally {
        setGrowthLoading(false);
      }
    })();
  }, [growthTick, getToken]);

  useEffect(() => {
    setSubsLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${BASE}/api/admin/subscriptions`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (response.ok) {
          const payload = await response.json() as { subscriptions: SubscriptionRow[] };
          setSubs(payload.subscriptions);
        }
      } finally {
        setSubsLoading(false);
      }
    })();
  }, [growthTick, getToken]);

  const isRefreshing = fetchingStats || fetchingAnalytics || growthLoading;
  const refresh = () => {
    void refetchStats();
    void refetchAnalytics();
    void refetchActivity();
    setGrowthTick((value) => value + 1);
  };

  const hasPaidSubscribers = (growthStats?.activeSubscribers ?? 0) > 0;
  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },
    { label: "Start", color: PLAN_COLORS.Start },
    { label: "Premium", color: PLAN_COLORS.Premium },
    { label: "Pro", color: PLAN_COLORS.Pro },
  ];

  const planDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (growthStats) {
      if (plan.label === "Free") value = growthStats.planBreakdown.free ?? 0;
      if (plan.label === "Start") value = growthStats.planBreakdown.start ?? growthStats.planBreakdown.pro ?? 0;
      if (plan.label === "Premium") value = growthStats.planBreakdown.premium ?? growthStats.planBreakdown.business ?? 0;
      if (plan.label === "Pro") value = growthStats.planBreakdown.agency ?? 0;
    }
    return { label: plan.label, value, color: plan.color };
  });

  const featureDonut = (analytics?.featureUsage ?? []).slice(0, 8).map((item, index) => ({
    label: FEATURE_NAME_MAP[item.name] ?? item.name,
    value: Number(item.count ?? 0),
    color: FEATURE_COLORS[index % FEATURE_COLORS.length],
  }));

  const actionDonut = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activity ?? []) {
      const label = normalizeAction(item.action);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], index) => ({ label, value, color: FEATURE_COLORS[index % FEATURE_COLORS.length] }));
  }, [activity]);

  const growthLine = (analytics?.userGrowth ?? []).map((item) => ({
    label: item.month,
    value: Number(item.users ?? 0),
    secondaryValue: Number(item.projects ?? 0),
  }));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Painel Administrativo</p>
            <h2 className="mb-1 text-2xl font-bold text-white">Visão Geral da Plataforma</h2>
            <p className="text-sm text-muted-foreground">Centro de comando — métricas, crescimento e atividade da plataforma.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white sm:mt-1 sm:shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <SectionLabel>Usuários</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PremiumMetric label="Total de Usuários" value={String(growthStats?.totalUsers ?? stats?.totalUsers ?? 0)} sub="usuários cadastrados" icon={Users} color="text-blue-300" glow="rgba(96,165,250,.11)" loading={statsLoading && growthLoading} />
        <PremiumMetric label="Novos esta Semana" value={String(growthStats?.newUsersThisWeek ?? 0)} sub="nos últimos 7 dias" icon={CalendarDays} color="text-emerald-300" glow="rgba(52,211,153,.11)" loading={growthLoading} />
        <PremiumMetric label="Novos este Mês" value={String(growthStats?.newUsersThisMonth ?? stats?.newUsersThisMonth ?? 0)} sub="nos últimos 30 dias" icon={UserCheck} color="text-purple-300" glow="rgba(167,139,250,.11)" loading={growthLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {growthLoading ? <Skeleton className="h-[330px] rounded-xl bg-white/5" /> : <DomnDonutChart data={planDonut} title="Distribuição de Planos" subtitle="Assinantes por plano" centerLabel="Usuários" />}
        </div>
        <div className="flex flex-col gap-4">
          <CompactMetric label="Conversão" value={`${growthStats?.conversionRate ?? 0}%`} icon={Percent} color="text-amber-300" glow="rgba(245,180,35,.10)" />
          <CompactMetric label="Ativação" value={`${growthStats?.activationRate ?? 0}%`} icon={UserCheck} color="text-emerald-300" glow="rgba(16,185,129,.10)" />
          <CompactMetric label="Planos Pagos" value={String(growthStats?.activeSubscribers ?? 0)} icon={CreditCard} color="text-violet-300" glow="rgba(139,92,246,.10)" />
        </div>
      </div>

      <SectionLabel>Análises</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PremiumMetric label="Execuções" value={String(stats?.totalActions ?? 0)} sub="total entre todos os usuários" icon={Zap} color="text-purple-300" glow="rgba(139,92,246,.11)" loading={statsLoading} />
        <PremiumMetric label="Receita Mensal" value={`R$ ${(growthStats?.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub="receita recorrente confirmada" icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.11)" loading={growthLoading} />
        <PremiumMetric label="Consumo / Mês" value={String(growthStats?.creditsSpentThisMonth ?? 0)} sub="créditos gastos este mês" icon={Activity} color="text-orange-300" glow="rgba(251,146,60,.11)" loading={growthLoading} />
      </div>

      {analyticsLoading ? <Skeleton className="h-72 rounded-xl bg-white/5" /> : <DomnLineChart data={growthLine} title="Crescimento — Usuários e Projetos" subtitle="Evolução dos últimos meses" />}

      <SectionLabel>Assinaturas</SectionLabel>
      <Card className="border-white/[0.07] bg-[#0d1015]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <CreditCard className="h-4 w-4 text-primary" /> Assinantes com Plano Pago
            <span className="ml-auto text-[10px] font-normal text-zinc-600">{subs.length} registros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subsLoading ? <Skeleton className="h-24 bg-white/5" /> : subs.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma assinatura registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-white/5 text-zinc-600"><th className="py-3 pr-4 font-medium">Usuário</th><th className="py-3 pr-4 font-medium">Plano</th><th className="py-3 pr-4 font-medium">Status Stripe</th><th className="py-3 font-medium">Período Atual</th></tr></thead>
                <tbody>{subs.map((sub) => (
                  <tr key={sub.id} className="border-b border-white/[0.03] last:border-0">
                    <td className="py-3 pr-4"><p className="font-medium text-white">{sub.name || "Sem nome"}</p><p className="text-zinc-600">{sub.email}</p></td>
                    <td className="py-3 pr-4"><span className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{PLAN_LABELS[sub.plan] ?? sub.plan}</span></td>
                    <td className="py-3 pr-4 text-zinc-500">{sub.stripeSubscriptionStatus || "sem assinatura"}</td>
                    <td className="py-3 text-zinc-500">{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SectionLabel>Atividade</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-2">
        {featureDonut.length ? <DomnDonutChart data={featureDonut} title="Uso por Módulo" subtitle="Distribuição de execuções" centerLabel="Ações" /> : <Card className="grid h-[330px] place-items-center border-white/5 bg-[#111111]"><p className="text-sm text-muted-foreground">Sem dados de uso.</p></Card>}
        {actionDonut.length ? <DomnDonutChart data={actionDonut} title="Atividade por Tipo de Ação" subtitle="Últimos eventos registrados" centerLabel="Eventos" /> : <Card className="grid h-[330px] place-items-center border-white/5 bg-[#111111]"><p className="text-sm text-muted-foreground">Sem atividade registrada.</p></Card>}
      </div>
    </div>
  );
}
