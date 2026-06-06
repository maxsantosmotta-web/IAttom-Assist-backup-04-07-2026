import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, RefreshCw, TrendingUp, Zap, CalendarDays, BarChart2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useListAdminActivity, getListAdminActivityQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { translateModule } from "@/lib/eventTranslations";

/* ─── constants ─────────────────────────────────────────────────── */
const MODULE_COLORS: Record<string, string> = {
  campaign:           "#fbbf24",
  content:            "#60a5fa",
  creative:           "#a78bfa",
  video_script:       "#fb7185",
  product_discovery:  "#C9A84C",
  product_validation: "#34d399",
  marketing:          "#fb923c",
};
const FALLBACK_COLORS = [
  "#C9A84C","#60a5fa","#a78bfa","#34d399","#fb7185","#fb923c","#fbbf24","#22d3ee",
];

/* ─── helpers ───────────────────────────────────────────────────── */
function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
function shortDay(iso: string) {
  const [,, dd] = iso.split("-");
  const d = new Date(`${iso}T12:00:00`);
  const month = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${dd}/${month}`;
}

/**
 * Normalizes a raw action string to a canonical PT-BR category.
 * Strips project-name suffixes (everything after ":") before matching.
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

/* ─── tooltip ───────────────────────────────────────────────────── */
const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-muted-foreground mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? p.fill ?? "#C9A84C" }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/* ─── AdminActivity ─────────────────────────────────────────────── */
export function AdminActivity() {
  const { data: activity, isLoading, isFetching, refetch } = useListAdminActivity(
    { limit: 100 },
    { query: { queryKey: getListAdminActivityQueryKey({ limit: 100 }), staleTime: 0 } },
  );

  /* ── derived data ────────────────────────────────────────────── */
  const items = activity ?? [];

  const { kpis, dailyChart, moduleChart, actionChart } = useMemo(() => {
    const now        = new Date();
    const todayKey   = dayKey(now);
    const week7ago   = new Date(now.getTime() - 7  * 86400000);
    const month30ago = new Date(now.getTime() - 30 * 86400000);

    let today = 0, week = 0, month = 0;
    for (const it of items) {
      const d = new Date(it.createdAt);
      if (dayKey(d) === todayKey) today++;
      if (d >= week7ago)   week++;
      if (d >= month30ago) month++;
    }

    const spanDays = items.length
      ? Math.max(1, Math.ceil((now.getTime() - new Date(items[items.length - 1].createdAt).getTime()) / 86400000))
      : 1;
    const avgDaily = week > 0 ? (week / Math.min(7, spanDays)).toFixed(1) : "0";

    /* timeline: last 14 days */
    const dailyMap: Record<string, number> = {};
    const days14: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = dayKey(new Date(now.getTime() - i * 86400000));
      days14.push(k);
      dailyMap[k] = 0;
    }
    for (const it of items) {
      const k = dayKey(new Date(it.createdAt));
      if (k in dailyMap) dailyMap[k]++;
    }
    const dailyChart = days14.map((k) => ({ date: shortDay(k), count: dailyMap[k] }));

    /* by module — normalize key to lowercase to prevent "campaign" vs "Campaign" splits */
    const modMap: Record<string, { count: number; rawKey: string }> = {};
    for (const it of items) {
      const k = it.module.toLowerCase();
      if (!modMap[k]) modMap[k] = { count: 0, rawKey: it.module };
      modMap[k].count++;
    }
    const moduleChart = Object.entries(modMap)
      .sort((a, b) => b[1].count - a[1].count).slice(0, 8)
      .map(([k, { count, rawKey }], i) => ({
        name: translateModule(rawKey),
        count,
        fill: MODULE_COLORS[k] ?? MODULE_COLORS[rawKey] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }));

    /* by action type — normalize to canonical categories to prevent per-project-name splits */
    const actionMap: Record<string, number> = {};
    for (const it of items) {
      const label = normalizeAction(it.action);
      actionMap[label] = (actionMap[label] ?? 0) + 1;
    }
    const actionChart = Object.entries(actionMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 9)
      .map(([name, count], i) => ({ name, count, fill: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));

    return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };
  }, [items]);

  return (
    <div className="space-y-8">

      {/* ── Header ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Monitoramento</p>
            <h2 className="text-2xl font-bold text-white mb-1">Atividade da Plataforma</h2>
            <p className="text-muted-foreground text-sm">Monitoramento visual das ações, execuções e movimentações da plataforma.</p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => void refetch()} disabled={isFetching}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 sm:shrink-0 sm:mt-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </motion.div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {([
          { label: "Hoje",           value: isLoading ? null : kpis.today,    sub: "ações registradas",   icon: Zap,         color: "text-primary bg-primary/10 border-primary/20" },
          { label: "Últimos 7 dias", value: isLoading ? null : kpis.week,     sub: "no período",          icon: CalendarDays,color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
          { label: "Últimos 30 dias",value: isLoading ? null : kpis.month,    sub: "no período",          icon: TrendingUp,  color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
          { label: "Média Diária",   value: isLoading ? null : kpis.avgDaily, sub: "ações/dia (7 dias)",  icon: BarChart2,   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
        ] as const).map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="bg-[#111111] border-white/5 hover:border-white/10 transition-colors">
            <CardContent className="p-5">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              {value === null
                ? <Skeleton className="h-8 w-16 bg-white/5 mb-1" />
                : <p className="text-2xl font-bold text-white mb-0.5">{value}</p>}
              <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ── Charts row 1: Timeline + Módulos ─────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Area: Movimento da Plataforma */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Movimento da Plataforma
                <span className="text-[10px] text-zinc-600 font-normal ml-auto">últimos 14 dias</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={2.5}
                      fill="url(#actGrad)" name="Ações"
                      dot={{ fill: "#a78bfa", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#a78bfa" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bar horizontal: Atividade por Módulo */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}>
          <Card className="bg-[#111111] border-white/5 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Atividade por Módulo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full bg-white/5 rounded-lg" />
              ) : moduleChart.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, moduleChart.length * 36)}>
                  <BarChart data={moduleChart} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Ações" radius={[0, 4, 4, 0]}>
                      {moduleChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Chart: Atividade por Tipo de Ação ────────────────────── */}
      {actionChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Atividade por Tipo de Ação
                <span className="text-[10px] text-zinc-600 font-normal ml-auto">top 9 · últimos 100 eventos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, actionChart.length * 36)}>
                <BarChart data={actionChart} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Ocorrências" radius={[0, 4, 4, 0]}>
                    {actionChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

    </div>
  );
}
