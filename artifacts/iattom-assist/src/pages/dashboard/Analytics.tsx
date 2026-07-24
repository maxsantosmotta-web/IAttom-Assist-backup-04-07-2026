import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart2, Zap, Clock, TrendingUp, Image, Search, CheckCircle, Megaphone, FileText, Sparkles, Video, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface AnalyticsData {
  activityByModule: { module: string; count: number }[];
  creditsSpent: { day: string; spent: number }[];
  imagesSpent: { day: string; spent: number }[];
  recentHistory: { id: number; action: string; module: string; createdAt: string }[];
  projectStats: { total: number; completed: number; inProgress: number };
  days: number;
}

const MODULE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  find_products: { label: "Buscar Produtos", color: "#C9A84C", icon: Search },
  product_discovery: { label: "Buscar Produtos", color: "#C9A84C", icon: Search },
  validate_products: { label: "Validar", color: "#34D399", icon: CheckCircle },
  product_validation: { label: "Validar", color: "#34D399", icon: CheckCircle },
  campaign: { label: "Campanha", color: "#FBBF24", icon: Megaphone },
  content: { label: "Conteúdo", color: "#60A5FA", icon: FileText },
  creative: { label: "Criar Imagem", color: "#C084FC", icon: Sparkles },
  video_script: { label: "Script de Vídeo", color: "#FB7185", icon: Video },
  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },
};

const DAYS_OPTIONS = [7, 14, 30, 90];
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.10] rounded-xl p-3 shadow-xl">
      <p className="text-[10px] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value}</p>
    </div>
  );
};

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics/user?days=${days}`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`Analytics failed: ${response.status}`);
        return response.json() as Promise<AnalyticsData>;
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days, refreshTick]);

  const totalRuns = data?.activityByModule.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const totalCredits = data?.creditsSpent.reduce((sum, item) => sum + item.spent, 0) ?? 0;
  const totalImages = data?.imagesSpent.reduce((sum, item) => sum + item.spent, 0) ?? 0;

  const chartModules = data?.activityByModule
    .map((item) => ({
      ...item,
      label: MODULE_META[item.module]?.label ?? item.module,
      color: MODULE_META[item.module]?.color ?? "#666",
    }))
    .sort((a, b) => b.count - a.count) ?? [];

  const creditsChart = data?.creditsSpent.map((item) => ({
    day: new Date(item.day).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }),
    spent: item.spent,
  })) ?? [];

  const statCards = [
    { label: "Execuções", value: totalRuns, icon: Zap, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "Créditos usados", value: totalCredits, icon: BarChart2, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { label: "Imagens usadas", value: totalImages, icon: Image, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
    { label: "Projetos na Biblioteca", value: data?.projectStats.total ?? 0, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  ];

  return (
    <div className="space-y-8 pb-4">
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }} className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-white">Seus Dados</h2>
            <p className="text-sm text-zinc-500">Uso e desempenho no seu espaço de trabalho</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 shrink-0">
            {DAYS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => setDays(option)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 ${days === option ? "bg-primary/20 text-primary" : "text-zinc-600 hover:text-zinc-300"}`}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setRefreshTick((value) => value + 1)} disabled={loading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show">
        {statCards.map((card) => (
          <motion.div key={card.label} variants={fadeUp} className="p-4 bg-[#0f0f0f] border border-white/[0.06] rounded-2xl hover:border-white/[0.10] transition-colors">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            {loading ? <Skeleton className="h-8 w-12 bg-white/[0.04] rounded-lg mb-1" /> : <p className="text-2xl font-black text-white tabular-nums">{card.value.toLocaleString("pt-BR")}</p>}
            <p className="text-xs text-zinc-600 font-medium mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center"><BarChart2 className="w-3.5 h-3.5 text-primary" /></div>
            <div><p className="text-sm font-bold text-zinc-200">Uso por Módulo</p><p className="text-xs text-zinc-600">Execuções por módulo nos últimos {days} dias</p></div>
          </div>
          {loading ? <Skeleton className="h-[180px] w-full bg-white/[0.03] rounded-xl" /> : chartModules.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center"><p className="text-sm text-zinc-700">Nenhuma atividade neste período</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartModules} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>{chartModules.map((item, index) => <Cell key={`${item.module}-${index}`} fill={item.color} fillOpacity={0.85} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-blue-400" /></div>
            <div><p className="text-sm font-bold text-zinc-200">Créditos gerais consumidos</p><p className="text-xs text-zinc-600">Sem incluir imagens, nos últimos {days} dias</p></div>
          </div>
          {loading ? <Skeleton className="h-[160px] w-full bg-white/[0.03] rounded-xl" /> : creditsChart.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center"><p className="text-sm text-zinc-700">Nenhum crédito consumido neste período</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={creditsChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs><linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3} /><stop offset="95%" stopColor="#60A5FA" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
                <Area type="monotone" dataKey="spent" stroke="#60A5FA" strokeWidth={2} fill="url(#credGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {data && data.recentHistory.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4, delay: 0.25 }}>
          <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.07] flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-zinc-500" /></div><p className="text-sm font-bold text-zinc-200">Atividade Recente</p></div>
            <div className="space-y-2">
              {data.recentHistory.map((item) => {
                const meta = MODULE_META[item.module];
                const Icon = meta?.icon ?? Zap;
                return (
                  <div key={item.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.07]"><Icon className="w-3 h-3 text-zinc-500" /></div>
                    <p className="text-xs text-zinc-400 flex-1 truncate">{item.action}</p>
                    <span className="text-[10px] text-zinc-700 shrink-0">{new Date(item.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
