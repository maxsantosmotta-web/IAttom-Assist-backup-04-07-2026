import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, RefreshCw, TrendingUp, Zap, CalendarDays, BarChart2, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAdminActivity, getListAdminActivityQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { translateModule } from "@/lib/eventTranslations";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const MODULE_COLORS: Record<string, string> = {
  campaign: "#fbbf24",
  content: "#60a5fa",
  creative: "#a78bfa",
  video_script: "#fb7185",
  product_discovery: "#22d3ee",
  product_validation: "#34d399",
  marketing: "#fb923c",
};

const FALLBACK_COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#fb7185", "#fbbf24", "#fb923c", "#60a5fa", "#C9A84C",
];

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }
function shortDay(iso: string) {
  const [,, dd] = iso.split("-");
  const d = new Date(`${iso}T12:00:00`);
  const month = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${dd}/${month}`;
}

function normalizeAction(action: string): string {
  const base = action.split(":")[0].trim();
  if (/campaign.*creat|creat.*campaign|campanha.*cria/i.test(base)) return "Campanhas Criadas";
  if (/campaign.*refin|block.*refin|bloco/i.test(base)) return "Blocos Refinados";
  if (/content.*creat|creat.*content|content.*gen|gen.*content|conteúdo/i.test(base)) return "Conteúdos Criados";
  if (/script.*creat|script.*gen|video.?script/i.test(base)) return "Scripts Gerados";
  if (/creative.*gen|gen.*creative|criativo/i.test(base)) return "Criativos Gerados";
  if (/creat.*project|project.*creat|projeto.*cri/i.test(base)) return "Projetos Criados";
  if (/updat.*project|project.*updat|projeto.*atualiz/i.test(base)) return "Projetos Atualizados";
  if (/complet.*project|project.*complet|projeto.*conclu/i.test(base)) return "Projetos Concluídos";
  if (/validat|validação/i.test(base)) return "Validações Executadas";
  if (/discover|descoberta/i.test(base)) return "Descobertas Executadas";
  if (/marketing/i.test(base)) return "Marketing Gerado";
  if (/prompt/i.test(base)) return "Prompts Criados";
  if (/delet|exclu/i.test(base)) return "Itens Excluídos";
  if (/restor|restaur/i.test(base)) return "Itens Restaurados";
  return base.length > 0 ? base : action;
}

function LiveStatus() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-300/80">
      <span className="relative flex h-2 w-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
          animate={{ scale: [1, 2.2, 1], opacity: [0.85, 0, 0.85] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      monitoramento ativo
    </div>
  );
}

function OperationalPulse({ data }: { data: Array<{ date: string; count: number }> }) {
  const width = 800;
  const height = 220;
  const padX = 18;
  const padY = 24;
  const max = Math.max(1, ...data.map((d) => d.count));
  const points = data.map((d, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(1, data.length - 1);
    const y = height - padY - (d.count / max) * (height - padY * 2);
    return `${x},${y}`;
  }).join(" ");
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const last = data[data.length - 1]?.count ?? 0;

  return (
    <div className="relative h-[250px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#070b10]">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)", backgroundSize: "100% 44px, 64px 100%" }} />
      <div className="absolute left-4 top-4 z-10 flex gap-6">
        <div><p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Eventos 14d</p><p className="text-xl font-black text-white">{total}</p></div>
        <div><p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Pulso atual</p><p className="text-xl font-black text-cyan-300">{last}</p></div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-x-0 bottom-0 h-[220px] w-full" preserveAspectRatio="none">
        <defs>
          <filter id="pulseGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="pulseStroke" x1="0" x2="1"><stop offset="0%" stopColor="#22d3ee"/><stop offset="55%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
        <motion.polyline
          points={points}
          fill="none"
          stroke="url(#pulseStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#pulseGlow)"
          strokeDasharray="18 12"
          animate={{ strokeDashoffset: [0, -120] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle cx={width - padX} cy={height - padY - (last / max) * (height - padY * 2)} r="6" fill="#22d3ee" animate={{ r: [4, 10, 4], opacity: [1, .2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
      </svg>
      <motion.div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-cyan-300/[0.12] to-transparent blur-xl" animate={{ left: ["-20%", "110%"] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
      <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[9px] text-zinc-700">{data.filter((_, i) => i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1).map((d) => <span key={d.date}>{d.date}</span>)}</div>
    </div>
  );
}

function OperationalRanking({ items, emptyText }: { items: Array<{ name: string; count: number; fill: string }>; emptyText: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.length === 0) return <div className="flex h-52 items-center justify-center text-xs text-muted-foreground">{emptyText}</div>;
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const percent = Math.max(10, (item.count / max) * 100);
        return (
          <div key={item.name} className="group relative overflow-hidden rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-3">
            <div className="mb-2 flex items-center gap-3">
              <span className="w-5 text-[10px] font-black text-zinc-700">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-xs font-semibold text-zinc-300">{item.name}</span>
              <span className="rounded-md border border-white/[0.07] bg-black/30 px-2 py-1 text-xs font-black tabular-nums text-white">{item.count}</span>
            </div>
            <div className="ml-8 h-2 overflow-hidden rounded-full bg-white/[0.045]">
              <motion.div className="relative h-full rounded-full" style={{ background: `linear-gradient(90deg, ${item.fill}88, ${item.fill})`, boxShadow: `0 0 18px ${item.fill}55` }} initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: .7, delay: index * .06 }}>
                <motion.div className="absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/45 to-transparent" animate={{ left: ["-40%", "120%"] }} transition={{ duration: 2.8 + index * .2, repeat: Infinity, ease: "linear" }} />
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
const panelClass = "relative overflow-hidden border border-white/[0.07] bg-[#0a0d13] shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.22)]";

export function AdminActivity() {
  const { getToken } = useAuth();
  const { toast } = useToast();

  async function downloadCsv(path: string, filename: string) {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { toast({ title: "Erro ao exportar", variant: "destructive" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch { toast({ title: "Erro ao exportar", variant: "destructive" }); }
  }

  const { data: activity, isLoading, isFetching, refetch } = useListAdminActivity(
    { limit: 100 },
    { query: { queryKey: getListAdminActivityQueryKey({ limit: 100 }), staleTime: 0 } },
  );
  const items = activity ?? [];

  const { kpis, dailyChart, moduleChart, actionChart } = useMemo(() => {
    const now = new Date();
    const todayKey = dayKey(now);
    const week7ago = new Date(now.getTime() - 7 * 86400000);
    const month30ago = new Date(now.getTime() - 30 * 86400000);
    let today = 0, week = 0, month = 0;
    for (const it of items) {
      const d = new Date(it.createdAt);
      if (dayKey(d) === todayKey) today++;
      if (d >= week7ago) week++;
      if (d >= month30ago) month++;
    }
    const spanDays = items.length ? Math.max(1, Math.ceil((now.getTime() - new Date(items[items.length - 1].createdAt).getTime()) / 86400000)) : 1;
    const avgDaily = week > 0 ? (week / Math.min(7, spanDays)).toFixed(1) : "0";
    const dailyMap: Record<string, number> = {};
    const days14: string[] = [];
    for (let i = 13; i >= 0; i--) { const k = dayKey(new Date(now.getTime() - i * 86400000)); days14.push(k); dailyMap[k] = 0; }
    for (const it of items) { const k = dayKey(new Date(it.createdAt)); if (k in dailyMap) dailyMap[k]++; }
    const dailyChart = days14.map((k) => ({ date: shortDay(k), count: dailyMap[k] }));
    const modMap: Record<string, { count: number; rawKey: string }> = {};
    for (const it of items) { const k = it.module.toLowerCase(); if (!modMap[k]) modMap[k] = { count: 0, rawKey: it.module }; modMap[k].count++; }
    const moduleChart = Object.entries(modMap).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([k, { count, rawKey }], i) => ({ name: translateModule(rawKey), count, fill: MODULE_COLORS[k] ?? MODULE_COLORS[rawKey] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));
    const actionMap: Record<string, number> = {};
    for (const it of items) { const label = normalizeAction(it.action); actionMap[label] = (actionMap[label] ?? 0) + 1; }
    const actionChart = Object.entries(actionMap).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([name, count], i) => ({ name, count, fill: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));
    return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };
  }, [items]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Monitoramento</p><h2 className="mb-1 text-2xl font-bold text-white">Atividade da Plataforma</h2><p className="text-sm text-muted-foreground">Monitoramento visual das ações, execuções e movimentações da plataforma.</p></div>
          <div className="flex flex-wrap items-center gap-3 sm:mt-1 sm:justify-end"><LiveStatus /><Button size="sm" variant="outline" onClick={() => void downloadCsv("/api/admin/export/activity", `atividade_${new Date().toISOString().slice(0, 10)}.csv`)} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"><Download className="h-3.5 w-3.5" />Exportar CSV</Button><Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          { label: "Hoje", value: isLoading ? null : kpis.today, sub: "ações registradas", icon: Zap, accent: "#fbbf24", color: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
          { label: "Últimos 7 dias", value: isLoading ? null : kpis.week, sub: "no período", icon: CalendarDays, accent: "#22d3ee", color: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20" },
          { label: "Últimos 30 dias", value: isLoading ? null : kpis.month, sub: "no período", icon: TrendingUp, accent: "#a78bfa", color: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
          { label: "Média Diária", value: isLoading ? null : kpis.avgDaily, sub: "ações/dia (7 dias)", icon: BarChart2, accent: "#34d399", color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
        ] as const).map(({ label, value, sub, icon: Icon, accent, color }) => <Card key={label} className={`${panelClass} group`}><div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} /><CardContent className="relative p-5"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${color}`}><Icon className="h-4 w-4" /></div>{value === null ? <Skeleton className="mb-1 h-8 w-16 bg-white/5" /> : <p className="mb-0.5 text-2xl font-bold tabular-nums text-white">{value}</p>}<p className="mb-0.5 text-xs font-semibold text-white">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></CardContent></Card>)}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={`${panelClass} h-full`}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp className="h-4 w-4 text-cyan-300" />Pulso Operacional<span className="ml-auto text-[10px] font-normal text-zinc-600">últimos 14 dias</span></CardTitle></CardHeader><CardContent>{isLoading ? <Skeleton className="h-[250px] w-full rounded-2xl bg-white/5" /> : <OperationalPulse data={dailyChart} />}</CardContent></Card>
        <Card className={`${panelClass} h-full`}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart2 className="h-4 w-4 text-cyan-300" />Ranking dos Módulos</CardTitle></CardHeader><CardContent>{isLoading ? <Skeleton className="h-60 w-full rounded-xl bg-white/5" /> : <OperationalRanking items={moduleChart} emptyText="Sem dados suficientes." />}</CardContent></Card>
      </div>

      {actionChart.length > 0 && <Card className={panelClass}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-amber-300" />Fluxo por Tipo de Ação<span className="ml-auto text-[10px] font-normal text-zinc-600">top 9 · últimos 100 eventos</span></CardTitle></CardHeader><CardContent><OperationalRanking items={actionChart} emptyText="Nenhuma atividade registrada." /></CardContent></Card>}
    </div>
  );
}
