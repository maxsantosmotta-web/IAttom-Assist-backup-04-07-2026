import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarDays,
  CreditCard,
  DollarSign,
  Percent,
  RefreshCw,
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
import { Card } from "@/components/ui/card";
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

interface FinancialSummary {
  mrr: number;
  revenueThisMonth: number;
}

interface CreditAnalytics {
  byDay: Array<{ day: string; total: number }>;
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

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [generalCreditsSpent, setGeneralCreditsSpent] = useState(0);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthTick, setGrowthTick] = useState(0);

  useEffect(() => {
    setGrowthLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [growthResponse, financialResponse, creditsResponse] = await Promise.all([
          fetch(`${BASE}/api/admin/growth-stats`, { headers, credentials: "include" }),
          fetch(`${BASE}/api/admin/financial-summary`, { headers, credentials: "include" }),
          fetch(`${BASE}/api/admin/credits-analytics`, { headers, credentials: "include" }),
        ]);

        if (growthResponse.ok) setGrowthStats(await growthResponse.json() as GrowthStats);
        if (financialResponse.ok) setFinancialSummary(await financialResponse.json() as FinancialSummary);
        if (creditsResponse.ok) {
          const credits = await creditsResponse.json() as CreditAnalytics;
          setGeneralCreditsSpent((credits.byDay ?? []).reduce((sum, item) => sum + Number(item.total || 0), 0));
        }
      } finally {
        setGrowthLoading(false);
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
    if (growthStats && hasPaidSubscribers) {
      if (plan.label === "Free") value = 0;
      if (plan.label === "Start") value = growthStats.planBreakdown.start ?? growthStats.planBreakdown.pro ?? 0;
      if (plan.label === "Premium") value = growthStats.planBreakdown.premium ?? growthStats.planBreakdown.business ?? 0;
      if (plan.label === "Pro") value = growthStats.planBreakdown.agency ?? 0;
    }
    return { label: plan.label, value, color: plan.color };
  });

  const featureDonut = (analytics?.featureUsage ?? [])
    .filter((item) => !["find_products", "validate_products"].includes(String(item.name ?? "").trim().toLowerCase().replaceAll(" ", "_")))
    .slice(0, 8)
    .map((item, index) => ({
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-white">Visão Geral</h2>
            <p className="text-sm text-muted-foreground">Acompanhamento geral da plataforma.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing} className="mt-1 shrink-0 gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <SectionLabel>Indicadores principais</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PremiumMetric label="Usuários Totais" value={(stats?.totalUsers ?? 0).toString()} icon={Users} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={statsLoading} />
        <PremiumMetric label="Usuários Ativos" value={(stats?.activeUsers ?? 0).toString()} icon={UserCheck} color="text-emerald-300" glow="rgba(16,185,129,.10)" loading={statsLoading} />
        <PremiumMetric label="Assinantes Pagos" value={(growthStats?.activeSubscribers ?? 0).toString()} icon={CreditCard} color="text-amber-300" glow="rgba(245,180,35,.10)" loading={growthLoading} />
        <PremiumMetric label="Conversão" value={`${growthStats?.conversionRate ?? 0}%`} icon={Percent} color="text-cyan-300" glow="rgba(34,211,238,.10)" loading={growthLoading} />
      </div>

      <SectionLabel>Receita e uso</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CompactMetric label="Receita Recorrente" value={formatMoney(growthStats?.mrr ?? 0)} icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.10)" />
        <CompactMetric label="Receita no Mês" value={formatMoney(financialSummary?.revenueThisMonth ?? 0)} icon={DollarSign} color="text-emerald-300" glow="rgba(16,185,129,.10)" />
        <CompactMetric label="Créditos Gastos" value={generalCreditsSpent.toLocaleString("pt-BR")} icon={Zap} color="text-violet-300" glow="rgba(139,92,246,.10)" />
        <CompactMetric label="Novos no Mês" value={(growthStats?.newUsersThisMonth ?? 0).toString()} icon={CalendarDays} color="text-cyan-300" glow="rgba(34,211,238,.10)" />
      </div>

      <SectionLabel>Distribuição</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-2">
        <DomnDonutChart data={featureDonut} title="Execuções por Módulo" subtitle="Distribuição operacional" centerLabel="Módulos" />
        <DomnDonutChart data={actionDonut} title="Atividades por Tipo" subtitle="Ações registradas" centerLabel="Ações" />
      </div>

      <SectionLabel>Crescimento</SectionLabel>
      <DomnLineChart data={growthLine} title="Crescimento da Plataforma" subtitle="Usuários e projetos" />
    </div>
  );
}
