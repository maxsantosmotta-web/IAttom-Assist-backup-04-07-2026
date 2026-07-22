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
const GOLD = "#C9A84C";
const PURPLE = "#a78bfa";
const EMERALD = "#34d399";
const ROSE = "#fb7185";

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

function StatTile({ label, value, sub, icon: Icon, color, glow, loading = false }: {
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
      style={{ backgroundImage: `radial-gradient(circle at 18% 16%, ${glow}, transparent 48%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)` }}
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
    { label: "Free", value: growth?.planBreakdown.free ?? 0, color: GOLD },
    { label: "Start", value: growth?.planBreakdown.start ?? growth?.planBreakdown.pro ?? 0, color: EMERALD },
    { label: "Premium", value: growth?.planBreakdown.premium ?? growth?.planBreakdown.business ?? 0, color: PURPLE },
    { label: "Pro", value: growth?.planBreakdown.agency ?? 0, color: ROSE },
  ];

  const activation = Math.max(0, Math.min(100, growth?.activationRate ?? 0));
  const activationData = [
    { label: "Ativados", value: activation, color: EMERALD },
    { label: "Não ativados", value: 100 - activation, color: "#27272a" },
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
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Painel Administrativo</p>
            <h2 className="mb-1 text-2xl font-bold text-white">Financeiro</h2>
            <p className="text-sm text-muted-foreground">Receita, assinaturas, planos e movimentações financeiras em uma única tela.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white sm:mt-1 sm:shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Receita Mensal" value={`R$ ${(growth?.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub="receita recorrente confirmada" icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.11)" loading={growthLoading} />
        <StatTile label="Planos Pagos" value={String(growth?.activeSubscribers ?? 0)} sub="assinaturas ativas" icon={CreditCard} color="text-emerald-300" glow="rgba(16,185,129,.10)" loading={growthLoading} />
        <StatTile label="Conversão" value={`${growth?.conversionRate ?? 0}%`} sub="usuários convertidos em pagantes" icon={Percent} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={growthLoading} />
        <StatTile label="Usuários" value={String(growth?.totalUsers ?? stats?.totalUsers ?? 0)} sub="base total cadastrada" icon={Users} color="text-rose-300" glow="rgba(251,113,133,.10)" loading={growthLoading && statsLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {growthLoading ? <Skeleton className="h-[330px] rounded-xl bg-white/5" /> : (
            <DomnDonutChart
              data={planData}
              title="Distribuição Financeira por Plano"
              subtitle="Assinaturas e usuários por categoria"
              centerLabel="Planos"
              fixedColorStructure
            />
          )}
        </div>
        <div className="grid gap-4">
          <StatTile label="Créditos Consumidos" value={String(growth?.creditsSpentThisMonth ?? 0)} sub="consumo no mês atual" icon={WalletCards} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={growthLoading} />
          <StatTile label="Execuções Totais" value={String(stats?.totalActions ?? 0)} sub="operações realizadas na plataforma" icon={BadgeDollarSign} color="text-amber-300" glow="rgba(245,180,35,.10)" loading={statsLoading} />
          {growthLoading ? <Skeleton className="h-[220px] rounded-xl bg-white/5" /> : (
            <DomnDonutChart
              data={activationData}
              title="Ativação"
              subtitle="Usuários que iniciaram o uso"
              centerLabel="Ativação"
              centerValue={`${activation}%`}
            />
          )}
        </div>
      </div>

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
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: [GOLD, EMERALD, PURPLE, ROSE][index % 4] }} />
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
    </div>
  );
}
