import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Download,
  PackagePlus,
  Percent,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DomnDonutChart } from "@/components/admin/AdminDomnCharts";

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const GOLD = "#C9A84C";
const PURPLE = "#a78bfa";
const EMERALD = "#34d399";
const ROSE = "#fb7185";
const PAGE_SIZE = 10;

const PLAN_NAMES: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};

const MOVEMENT_TYPE_NAMES: Record<FinancialMovement["type"], string> = {
  subscription: "Assinatura",
  credit_pack: "Compra de créditos",
  creative_pack: "Compra de imagens",
  video_pack: "Compra de vídeos",
};

interface FinancialMovement {
  id: string;
  type: "subscription" | "credit_pack" | "creative_pack" | "video_pack";
  label: string;
  userName: string | null;
  userEmail: string;
  plan: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface FinancialSummary {
  mrr: number;
  revenueThisMonth: number;
  packageRevenueThisMonth: number;
  activeSubscribers: number;
  totalUsers: number;
  conversionRate: number;
  planBreakdown: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  mrrByPlan: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  recentMovements: FinancialMovement[];
}

function formatMoney(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value);
}

function getPlanName(plan: string): string {
  return PLAN_NAMES[plan.toLowerCase()] ?? plan.toUpperCase();
}

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
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
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${BASE}/api/admin/financial-summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (!response.ok) throw new Error(`Financial summary failed: ${response.status}`);
        const data = await response.json() as FinancialSummary;
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [getToken, tick]);

  const refresh = () => {
    setRefreshing(true);
    setTick((value) => value + 1);
  };

  const planData = [
    { label: "FREE", value: summary?.planBreakdown.free ?? 0, color: GOLD },
    { label: "START", value: summary?.planBreakdown.pro ?? 0, color: EMERALD },
    { label: "PREMIUM", value: summary?.planBreakdown.business ?? 0, color: PURPLE },
    { label: "PRO", value: summary?.planBreakdown.agency ?? 0, color: ROSE },
  ];

  const revenueData = [
    { label: "Receita recorrente", value: summary?.mrr ?? 0, color: GOLD },
    { label: "Pacotes avulsos", value: summary?.packageRevenueThisMonth ?? 0, color: PURPLE },
  ];

  const movements = summary?.recentMovements ?? [];
  const filteredMovements = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return movements.filter((item) => {
      const createdAt = new Date(item.createdAt);
      const matchesSearch = !normalizedSearch || [
        item.label,
        item.userName ?? "",
        item.userEmail,
        getPlanName(item.plan),
        MOVEMENT_TYPE_NAMES[item.type],
        item.status,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStart = !start || createdAt >= start;
      const matchesEnd = !end || createdAt <= end;
      return matchesSearch && matchesType && matchesStart && matchesEnd;
    });
  }, [movements, search, typeFilter, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, startDate, endDate, showFullHistory]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedMovements = showFullHistory
    ? filteredMovements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : movements.slice(0, 10);

  const exportHistory = () => {
    const rows = filteredMovements.map((item) => [
      new Date(item.createdAt).toLocaleString("pt-BR"),
      MOVEMENT_TYPE_NAMES[item.type],
      item.label,
      item.userName ?? "",
      item.userEmail,
      getPlanName(item.plan),
      item.status,
      formatMoney(item.amountCents / 100, item.currency),
    ]);
    const header = ["Data", "Tipo", "Descrição", "Usuário", "Email", "Plano", "Status", "Valor"];
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historico_financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Painel Administrativo</p>
            <h2 className="mb-1 text-2xl font-bold text-white">Financeiro</h2>
            <p className="text-sm text-muted-foreground">Receita, assinaturas, planos e movimentações confirmadas pelo Stripe.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading || refreshing} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white sm:mt-1 sm:shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${(loading || refreshing) ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Receita do mês" value={formatMoney(summary?.revenueThisMonth ?? 0)} sub="assinaturas e pacotes pagos" icon={DollarSign} color="text-amber-300" glow="rgba(245,180,35,.11)" loading={loading} />
        <StatTile label="Receita recorrente mensal" value={formatMoney(summary?.mrr ?? 0)} sub="assinaturas ativas" icon={CreditCard} color="text-emerald-300" glow="rgba(16,185,129,.10)" loading={loading} />
        <StatTile label="Assinantes pagos" value={String(summary?.activeSubscribers ?? 0)} sub="assinaturas ativas confirmadas" icon={Users} color="text-violet-300" glow="rgba(139,92,246,.10)" loading={loading} />
        <StatTile label="Conversão" value={`${summary?.conversionRate ?? 0}%`} sub="usuários convertidos em pagantes" icon={Percent} color="text-rose-300" glow="rgba(251,113,133,.10)" loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {loading ? <Skeleton className="h-[330px] rounded-xl bg-white/5" /> : (
          <DomnDonutChart data={planData} title="Distribuição por Plano" subtitle="Assinaturas ativas e usuários FREE" centerLabel="Planos" fixedColorStructure />
        )}
        {loading ? <Skeleton className="h-[330px] rounded-xl bg-white/5" /> : (
          <DomnDonutChart data={revenueData} title="Composição da Receita" subtitle="Receita recorrente e pacotes pagos no mês" centerLabel="Receita" fixedColorStructure />
        )}
      </div>

      <Card
        className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]"
        style={{ backgroundImage: "radial-gradient(circle at 8% 0%, rgba(201,168,76,.09), transparent 38%), linear-gradient(135deg, rgba(255,255,255,.014), transparent 55%)" }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{showFullHistory ? "Histórico financeiro" : "Movimentações financeiras recentes"}</h3>
              <p className="text-xs text-zinc-600">Assinaturas e pacotes efetivamente pagos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showFullHistory && filteredMovements.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={exportHistory} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
            )}
            {movements.length > 10 && (
              <button type="button" onClick={() => setShowFullHistory((value) => !value)} className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                {showFullHistory ? "Voltar às recentes" : `Ver histórico (${movements.length})`}
              </button>
            )}
          </div>
        </div>

        {showFullHistory && (
          <div className="mb-4 grid gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative block xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar usuário, email, plano ou descrição" className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 pl-9 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-primary/40" />
            </label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-lg border border-white/[0.08] bg-[#0d1015] px-3 text-xs text-zinc-300 outline-none focus:border-primary/40">
              <option value="all">Todos os tipos</option>
              <option value="subscription">Assinaturas</option>
              <option value="credit_pack">Créditos</option>
              <option value="creative_pack">Imagens</option>
              <option value="video_pack">Vídeos</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Data inicial" className="h-9 min-w-0 rounded-lg border border-white/[0.08] bg-[#0d1015] px-2 text-[11px] text-zinc-300 outline-none focus:border-primary/40" />
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Data final" className="h-9 min-w-0 rounded-lg border border-white/[0.08] bg-[#0d1015] px-2 text-[11px] text-zinc-300 outline-none focus:border-primary/40" />
            </div>
          </div>
        )}

        {loading ? (
          <Skeleton className="h-28 w-full bg-white/5" />
        ) : !pagedMovements.length ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-xs text-zinc-600">Nenhuma movimentação encontrada.</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {pagedMovements.map((item, index) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: [GOLD, EMERALD, PURPLE, ROSE][index % 4] }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-200">{item.label || MOVEMENT_TYPE_NAMES[item.type]}</p>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-600">{item.userName || item.userEmail} · {getPlanName(item.plan)} · {item.status}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-zinc-200">{formatMoney(item.amountCents / 100, item.currency)}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-700">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showFullHistory && filteredMovements.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-4">
            <p className="text-[10px] text-zinc-600">{filteredMovements.length} movimentações · página {safePage} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="h-8 border-white/10 px-2 text-zinc-400">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="h-8 border-white/10 px-2 text-zinc-400">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
