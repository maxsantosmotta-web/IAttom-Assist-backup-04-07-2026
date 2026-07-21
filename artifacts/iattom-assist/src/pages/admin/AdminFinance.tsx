import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeDollarSign,
  CreditCard,
  DollarSign,
  PackagePlus,
  Percent,
  RefreshCw,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import {
  getGetAdminStatsQueryKey,
  getListAdminActivityQueryKey,
  useGetAdminAnalytics,
  useGetAdminStats,
  useListAdminActivity,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DomnDonutChart } from "@/components/admin/AdminDomnCharts";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const GOLD = "#C9A84C";
const PURPLE = "#a78bfa";
const EMERALD = "#34d399";
const BLUE = "#60a5fa";

interface GrowthStats {
  mrr: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  activationRate: number;
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

const PLAN_COLORS: Record<string, string> = {
  Free: BLUE,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: GOLD,
};

function StatTile({
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
      {loading ? <Skeleton className="mb-2 h-7 w-24 bg-white/5" /> : <p className="text-2xl font-bold text-white">{value}</p>}
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-700">{sub}</p>}
    </div>
  );
}

export function AdminFinance() {
  const { getToken } = useAuth();
  const [growth, setGrowth] = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const { data: analytics, isFetching: analyticsFetching, refetch: refetchAnalytics } = useGetAdminAnalytics();
  const { data: stats, isLoading: statsLoading, isFetching: statsFetching, refetch: refetchStats } =
    useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), staleTime: 0 } });
  const { data: activity, isFetching: activityFetching, refetch: refetchActivity } =
    useListAdminActivity(
      { limit: 200 },
      { query: { queryKey: getListAdminActivityQueryKey({ limit: 200 }), staleTime: 0 } },
    );

  useEffect(() => {
    setGrowthLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${BASE}/api/admin/growth-stats`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (response.ok) setGrowth(await response.json() as GrowthStats);
      } finally {
        setGrowthLoading(false);
      }
    })();
  }, [getToken, tick]);

  const hasPaidSubscribers = (growth?.activeSubscribers ?? 0) > 0;
  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },
    { label: "Start", color: PLAN_COLORS.Start },
    { label: "Premium", color: PLAN_COLORS.Premium },
    { label: "Pro", color: PLAN_COLORS.Pro },
  ];

  const planData = planDefinitions.map((plan) => {
    let value = 0;
    if (growth) {
      if (plan.label === "Free") value = growth.planBreakdown.free ?? 0;
      if (plan.label === "Start") value = growth.planBreakdown.start ?? growth.planBreakdown.pro ?? 0;
      if (plan.label === "Premium") value = growth.planBreakdown.premium ?? growth.planBreakdown.business ?? 0;
      if (plan.label === "Pro") value = growth.planBreakdown.agency ?? 0;
    }
    return { label: plan.label, value, color: plan.color };
  });

  const revenueByLabel = new Map<string, number>();
  if (hasPaidSubscribers) {
    for (const item of analytics?.planRevenue ?? []) {
      const key = item.plan?.toLowerCase();
      if (key === "free") revenueByLabel.set("Free", item.mrr ?? 0);
      if (key === "start") revenueByLabel.set("Start", item.mrr ?? 0);
      if (key === "premium" || key === "business") revenueByLabel.set("Premium", item.mrr ?? 0);
      if (key === "pro" || key === "agency") revenueByLabel.set("Pro", item.mrr ?? 0);
    }
  }

  const revenueData = planDefinitions.map((plan) => ({
    label: plan.label,
    value: revenueByLabel.get(plan.label) ?? 0,
    color: plan.color,
  }));

  const financialActivity = useMemo(() => (activity ?? []).filter((item) =>
    /pagamento|assinatura|plano|crédito|credito|stripe|checkout|cancel|pacote/i.test(`${item.action} ${item.details ?? ""}`),
  ).slice(0, 12), [activity]);

  const refresh = () => {
    void refetchStats();
    void refetchAnalytics();
    void refetchActivity();
    setTick((value) => value + 1);
  };
  const refreshing = statsFetching || analyticsFetching || activityFetching || growthLoading;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-white">Financeiro</h2>
            <p className="text-sm text-muted-foreground">Receita, assinaturas, planos e movimentações financeiras em uma única tela.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing} className="mt-1 shrink-0 gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Receita e Assinaturas</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Receita Mensal" value={`R$ ${(growth?.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub="receita recorrente confirmada" icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.11)" loading={growthLoading} />
          <StatTile label="Planos Pagos" value={String(growth?.activeSubscribers ?? 0)} sub="assinaturas ativas" icon={CreditCard} color="text-emerald-300" glow="rgba(16,185,129,.10)" loading={growthLoading} />
          <StatTile label="Taxa de Conversão" value={`${growth?.conversionRate ?? 0}%`} sub="Free → Pago" icon={TrendingUp} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={growthLoading} />
          <StatTile label="Usuários" value={String(growth?.totalUsers ?? stats?.totalUsers ?? 0)} sub="base total cadastrada" icon={Users} color="text-blue-300" glow="rgba(96,165,250,.11)" loading={growthLoading && statsLoading} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatTile label="Créditos Consumidos" value={String(growth?.creditsSpentThisMonth ?? 0)} sub="consumo no mês atual" icon={WalletCards} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={growthLoading} />
          <StatTile label="Execuções Totais" value={String(stats?.totalActions ?? 0)} sub="operações realizadas na plataforma" icon={BadgeDollarSign} color="text-amber-300" glow="rgba(245,180,35,.10)" loading={statsLoading} />
          <StatTile label="Taxa de Ativação" value={`${growth?.activationRate ?? 0}%`} sub="usuários que iniciaram o uso" icon={Activity} color="text-cyan-300" glow="rgba(34,211,238,.10)" loading={growthLoading} />
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          {growthLoading ? <Skeleton className="h-[330px] rounded-2xl bg-white/5" /> : <DomnDonutChart data={planData} title="Distribuição de Planos" subtitle="Assinantes por plano" centerLabel="Usuários" />}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          {analyticsFetching ? <Skeleton className="h-[330px] rounded-2xl bg-white/5" /> : <DomnDonutChart data={revenueData} title="Receita por Plano" subtitle="Receita recorrente mensal" centerLabel="MRR" />}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
        <Card
          className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]"
          style={{ backgroundImage: "radial-gradient(circle at 8% 0%, rgba(201,168,76,.09), transparent 38%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Movimentações financeiras recentes</h3>
              <p className="text-xs text-zinc-600">Pagamentos, planos, créditos, pacotes e cancelamentos registrados na atividade.</p>
            </div>
          </div>
          {financialActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-xs text-zinc-600">Nenhuma movimentação financeira registrada ainda.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {financialActivity.map((item, index) => (
                <div key={`${item.action}-${index}`} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: [GOLD, EMERALD, PURPLE, BLUE][index % 4] }} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-200">{item.action}</p>
                      {item.details && <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-600">{item.details}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-700">{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
