import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  CreditCard,
  DollarSign,
  PackagePlus,
  Percent,
  RefreshCw,
  Users,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import {
  getGetAdminStatsQueryKey,
  getListAdminActivityQueryKey,
  useGetAdminStats,
  useListAdminActivity,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DomnDonutChart } from "@/components/admin/AdminDomnCharts";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

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
  Free: "#60a5fa",
  Start: "#34d399",
  Premium: "#a78bfa",
  Pro: "#C9A84C",
};

function Metric({ label, value, sub, icon: Icon, loading = false }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card className="border-white/[0.07] bg-[#0d1015] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      {loading ? <Skeleton className="mb-2 h-7 w-24 bg-white/5" /> : <p className="text-2xl font-bold text-white">{value}</p>}
      <p className="text-xs font-semibold text-white">{label}</p>
      <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>
    </Card>
  );
}

export function AdminFinance() {
  const { getToken } = useAuth();
  const [growth, setGrowth] = useState<GrowthStats | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [tick, setTick] = useState(0);

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

  const planData = [
    { label: "Free", value: growth?.planBreakdown.free ?? 0, color: PLAN_COLORS.Free },
    { label: "Start", value: growth?.planBreakdown.start ?? growth?.planBreakdown.pro ?? 0, color: PLAN_COLORS.Start },
    { label: "Premium", value: growth?.planBreakdown.premium ?? growth?.planBreakdown.business ?? 0, color: PLAN_COLORS.Premium },
    { label: "Pro", value: growth?.planBreakdown.agency ?? 0, color: PLAN_COLORS.Pro },
  ];

  const financialActivity = useMemo(() => (activity ?? []).filter((item) =>
    /pagamento|assinatura|plano|crédito|credito|stripe|checkout|cancel|pacote/i.test(`${item.action} ${item.details ?? ""}`),
  ).slice(0, 12), [activity]);

  const refresh = () => {
    void refetchStats();
    void refetchActivity();
    setTick((value) => value + 1);
  };
  const refreshing = statsFetching || activityFetching || growthLoading;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Painel Administrativo</p>
            <h2 className="text-2xl font-bold text-white">Financeiro</h2>
            <p className="mt-1 text-sm text-muted-foreground">Receita, assinaturas, planos e movimentações financeiras em uma única tela.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing} className="gap-1.5 border-white/10 text-zinc-400 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Receita Mensal" value={`R$ ${(growth?.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub="receita recorrente confirmada" icon={DollarSign} loading={growthLoading} />
        <Metric label="Planos Pagos" value={String(growth?.activeSubscribers ?? 0)} sub="assinaturas ativas" icon={CreditCard} loading={growthLoading} />
        <Metric label="Conversão" value={`${growth?.conversionRate ?? 0}%`} sub="usuários convertidos em pagantes" icon={Percent} loading={growthLoading} />
        <Metric label="Usuários" value={String(growth?.totalUsers ?? stats?.totalUsers ?? 0)} sub="base total cadastrada" icon={Users} loading={growthLoading && statsLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {growthLoading ? <Skeleton className="h-[330px] rounded-xl bg-white/5" /> : <DomnDonutChart data={planData} title="Distribuição Financeira por Plano" subtitle="Assinaturas e usuários por categoria" centerLabel="Planos" />}
        </div>
        <div className="grid gap-4">
          <Metric label="Créditos Consumidos" value={String(growth?.creditsSpentThisMonth ?? 0)} sub="consumo no mês atual" icon={WalletCards} loading={growthLoading} />
          <Metric label="Execuções Totais" value={String(stats?.totalActions ?? 0)} sub="operações realizadas na plataforma" icon={BadgeDollarSign} loading={statsLoading} />
          <Metric label="Ativação" value={`${growth?.activationRate ?? 0}%`} sub="usuários que iniciaram o uso" icon={PackagePlus} loading={growthLoading} />
        </div>
      </div>

      <Card className="border-white/[0.07] bg-[#0d1015] p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Movimentações financeiras recentes</h3>
          <p className="text-xs text-zinc-600">Pagamentos, planos, créditos, pacotes e cancelamentos registrados na atividade.</p>
        </div>
        {financialActivity.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-xs text-zinc-600">Nenhuma movimentação financeira registrada ainda.</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {financialActivity.map((item, index) => (
              <div key={`${item.action}-${index}`} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-xs font-medium text-zinc-200">{item.action}</p>
                  {item.details && <p className="mt-0.5 text-[10px] text-zinc-600">{item.details}</p>}
                </div>
                <span className="shrink-0 text-[10px] text-zinc-700">{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
