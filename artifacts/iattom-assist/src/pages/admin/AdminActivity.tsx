import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, RefreshCw, TrendingUp, Zap, CalendarDays, BarChart2, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
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

const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#080a0f]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      {label && <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? p.fill ?? "#C9A84C" }} className="font-semibold tabular-nums">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function LiveScanner({ color, duration = 6 }: { color: string; duration?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]" aria-hidden="true">
      <motion.div
        className="absolute -inset-y-1 w-28 opacity-50 blur-xl"
        style={{ background: `linear-gradient(90deg, transparent, ${color}33, ${color}66, ${color}22, transparent)` }}
        animate={{ x: ["-160%", "780%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear", repeatDelay: 0.4 }}
      />
      <motion.div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        animate={{ opacity: [0.25, 0.9, 0.25] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
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
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
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

    let today = 0;
    let week = 0;
    let month = 0;
    for (const it of items) {
      const d = new Date(it.createdAt);
      if (dayKey(d) === todayKey) today++;
      if (d >= week7ago) week++;
      if (d >= month30ago) month++;
    }

    const spanDays = items.length
      ? Math.max(1, Math.ceil((now.getTime() - new Date(items[items.length - 1].createdAt).getTime()) / 86400000))
      : 1;
    const avgDaily = week > 0 ? (week / Math.min(7, spanDays)).toFixed(1) : "0";

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

    const modMap: Record<string, { count: number; rawKey: string }> = {};
    for (const it of items) {
      const k = it.module.toLowerCase();
      if (!modMap[k]) modMap[k] = { count: 0, rawKey: it.module };
      modMap[k].count++;
    }
    const moduleChart = Object.entries(modMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([k, { count, rawKey }], i) => ({
        name: translateModule(rawKey),
        count,
        fill: MODULE_COLORS[k] ?? MODULE_COLORS[rawKey] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }));

    const actionMap: Record<string, number> = {};
    for (const it of items) {
      const label = normalizeAction(it.action);
      actionMap[label] = (actionMap[label] ?? 0) + 1;
    }
    const actionChart = Object.entries(actionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([name, count], i) => ({ name, count, fill: FALLBACK_COLORS[i % FALLBACK_COLORS.length] }));

    return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };
  }, [items]);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-primary">Monitoramento</p>
            <h2 className="mb-1 text-2xl font-bold text-white">Atividade da Plataforma</h2>
            <p className="text-sm text-muted-foreground">Monitoramento visual das ações, execuções e movimentações da plataforma.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:mt-1 sm:justify-end">
            <LiveStatus />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadCsv("/api/admin/export/activity", `atividade_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {([
          { label: "Hoje", value: isLoading ? null : kpis.today, sub: "ações registradas", icon: Zap, accent: "#fbbf24", color: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
          { label: "Últimos 7 dias", value: isLoading ? null : kpis.week, sub: "no período", icon: CalendarDays, accent: "#22d3ee", color: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20" },
          { label: "Últimos 30 dias", value: isLoading ? null : kpis.month, sub: "no período", icon: TrendingUp, accent: "#a78bfa", color: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
          { label: "Média Diária", value: isLoading ? null : kpis.avgDaily, sub: "ações/dia (7 dias)", icon: BarChart2, accent: "#34d399", color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
        ] as const).map(({ label, value, sub, icon: Icon, accent, color }, index) => (
          <Card key={label} className={`${panelClass} group transition-colors hover:border-white/[0.12]`}>
            <LiveScanner color={accent} duration={7 + index} />
            <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: accent }} />
            <CardContent className="relative z-[2] p-5">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {value === null
                ? <Skeleton className="mb-1 h-8 w-16 bg-white/5" />
                : <motion.p className="mb-0.5 text-2xl font-bold tabular-nums text-white" animate={{ opacity: [0.82, 1, 0.82] }} transition={{ duration: 3.2, repeat: Infinity }}>{value}</motion.p>}
              <p className="mb-0.5 text-xs font-semibold text-white">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          <Card className={`${panelClass} h-full`}>
            <LiveScanner color="#a78bfa" duration={5.5} />
            <div className="absolute -right-20 -top-24 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
            <CardHeader className="relative z-[2] pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <TrendingUp className="h-4 w-4 text-violet-300" />
                Movimento da Plataforma
                <span className="ml-auto text-[10px] font-normal text-zinc-600">últimos 14 dias</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-[2]">
              {isLoading ? (
                <Skeleton className="h-52 w-full rounded-lg bg-white/5" />
              ) : (
                <div className="relative">
                  <motion.div
                    className="pointer-events-none absolute inset-y-4 z-[3] w-px bg-gradient-to-b from-transparent via-violet-300 to-transparent shadow-[0_0_16px_rgba(167,139,250,0.9)]"
                    animate={{ left: ["2%", "98%", "2%"] }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyChart} margin={{ top: 14, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="activityLine" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55} />
                          <stop offset="55%" stopColor="#7c3aed" stopOpacity={0.16} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                        <filter id="activityGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#5d606b" }} axisLine={false} tickLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10, fill: "#5d606b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(167,139,250,0.22)", strokeDasharray: "4 4" }} />
                      <Area type="monotone" dataKey="count" stroke="#c4b5fd" strokeWidth={3} fill="url(#activityLine)" name="Ações" dot={{ fill: "#c4b5fd", r: 2.5, stroke: "#11131a", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#ffffff", stroke: "#a78bfa", strokeWidth: 3 }} animationDuration={950} style={{ filter: "url(#activityGlow)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}>
          <Card className={`${panelClass} h-full`}>
            <LiveScanner color="#22d3ee" duration={5.8} />
            <div className="absolute -left-20 -bottom-24 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
            <CardHeader className="relative z-[2] pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart2 className="h-4 w-4 text-cyan-300" />Atividade por Módulo</CardTitle></CardHeader>
            <CardContent className="relative z-[2]">
              {isLoading ? <Skeleton className="h-52 w-full rounded-lg bg-white/5" /> : moduleChart.length === 0 ? (
                <div className="flex h-52 items-center justify-center"><div className="text-center"><Activity className="mx-auto mb-2 h-6 w-6 text-white/10" /><p className="text-xs text-muted-foreground">Sem dados suficientes.</p></div></div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, moduleChart.length * 40)}>
                  <BarChart data={moduleChart} layout="vertical" margin={{ top: 6, right: 38, left: 10, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#5d606b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={92} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.025)" }} />
                    <Bar dataKey="count" name="Ações" radius={[0, 18, 18, 0]} maxBarSize={22} animationDuration={850}>{moduleChart.map((entry) => <Cell key={entry.name} fill={entry.fill} stroke={entry.fill} strokeOpacity={0.45} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {actionChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}>
          <Card className={panelClass}>
            <LiveScanner color="#fbbf24" duration={6.2} />
            <div className="absolute -right-16 -bottom-24 h-52 w-52 rounded-full bg-amber-400/[0.08] blur-3xl" />
            <CardHeader className="relative z-[2] pb-2"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-white"><Zap className="h-4 w-4 text-amber-300" />Atividade por Tipo de Ação<span className="ml-auto text-[10px] font-normal text-zinc-600">top 9 · últimos 100 eventos</span></CardTitle></CardHeader>
            <CardContent className="relative z-[2]">
              <ResponsiveContainer width="100%" height={Math.max(220, actionChart.length * 40)}>
                <BarChart data={actionChart} layout="vertical" margin={{ top: 6, right: 38, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#5d606b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#a1a1aa" }} axisLine={false} tickLine={false} width={142} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.025)" }} />
                  <Bar dataKey="count" name="Ocorrências" radius={[0, 18, 18, 0]} maxBarSize={22} animationDuration={900}>{actionChart.map((entry) => <Cell key={entry.name} fill={entry.fill} stroke={entry.fill} strokeOpacity={0.45} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
