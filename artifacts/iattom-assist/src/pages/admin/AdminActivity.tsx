import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCw, TrendingUp, Zap, CalendarDays, BarChart2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAdminActivity, getListAdminActivityQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { translateModule } from "@/lib/eventTranslations";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { DomnBarChart, DomnLineChart } from "@/components/admin/AdminDomnCharts";

const MODULE_COLORS: Record<string, string> = {
  campaign: "#fbbf24",
  content: "#60a5fa",
  creative: "#a78bfa",
  video_script: "#fb7185",
  product_discovery: "#3fd7ff",
  product_validation: "#64e6a6",
  marketing: "#ff9f5a",
};

const FALLBACK_COLORS = ["#f4c95d", "#3fd7ff", "#ff5cc8", "#64e6a6", "#9b82ff", "#ff9f5a", "#ff657f"];

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

const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

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
    let today = 0, week = 0, month = 0;

    for (const item of items) {
      const date = new Date(item.createdAt);
      if (dayKey(date) === todayKey) today++;
      if (date >= week7ago) week++;
      if (date >= month30ago) month++;
    }

    const spanDays = items.length
      ? Math.max(1, Math.ceil((now.getTime() - new Date(items[items.length - 1].createdAt).getTime()) / 86400000))
      : 1;
    const avgDaily = week > 0 ? (week / Math.min(7, spanDays)).toFixed(1) : "0";

    const dailyMap: Record<string, number> = {};
    const days14: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * 86400000));
      days14.push(key);
      dailyMap[key] = 0;
    }
    for (const item of items) {
      const key = dayKey(new Date(item.createdAt));
      if (key in dailyMap) dailyMap[key]++;
    }
    const dailyChart = days14.map((key) => ({ label: shortDay(key), value: dailyMap[key] }));

    const moduleMap: Record<string, { count: number; rawKey: string }> = {};
    for (const item of items) {
      const key = item.module.toLowerCase();
      if (!moduleMap[key]) moduleMap[key] = { count: 0, rawKey: item.module };
      moduleMap[key].count++;
    }
    const moduleChart = Object.entries(moduleMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([key, { count, rawKey }], index) => ({
        label: translateModule(rawKey),
        value: count,
        color: MODULE_COLORS[key] ?? MODULE_COLORS[rawKey] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      }));

    const actionMap: Record<string, number> = {};
    for (const item of items) {
      const label = normalizeAction(item.action);
      actionMap[label] = (actionMap[label] ?? 0) + 1;
    }
    const actionChart = Object.entries(actionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([label, value], index) => ({ label, value, color: FALLBACK_COLORS[index % FALLBACK_COLORS.length] }));

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
          <div className="flex items-center gap-2 sm:mt-1 sm:shrink-0">
            <Button size="sm" variant="outline" onClick={() => void downloadCsv("/api/admin/export/activity", `atividade_${new Date().toISOString().slice(0,10)}.csv`)} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          { label: "Hoje", value: isLoading ? null : kpis.today, sub: "ações registradas", icon: Zap, color: "text-primary bg-primary/10 border-primary/20" },
          { label: "Últimos 7 dias", value: isLoading ? null : kpis.week, sub: "no período", icon: CalendarDays, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
          { label: "Últimos 30 dias", value: isLoading ? null : kpis.month, sub: "no período", icon: TrendingUp, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
          { label: "Média Diária", value: isLoading ? null : kpis.avgDaily, sub: "ações/dia (7 dias)", icon: BarChart2, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
        ] as const).map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="border-white/5 bg-[#111111] transition-colors hover:border-white/10">
            <CardContent className="p-5">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${color}`}><Icon className="h-4 w-4" /></div>
              {value === null ? <Skeleton className="mb-1 h-8 w-16 bg-white/5" /> : <p className="mb-0.5 text-2xl font-bold text-white">{value}</p>}
              <p className="mb-0.5 text-xs font-semibold text-white">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          {isLoading ? <Skeleton className="h-[330px] w-full rounded-2xl bg-white/5" /> : <DomnLineChart data={dailyChart} title="Movimento da Plataforma" subtitle="Últimos 14 dias" />}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}>
          {isLoading ? <Skeleton className="h-[330px] w-full rounded-2xl bg-white/5" /> : moduleChart.length ? <DomnBarChart data={moduleChart} title="Atividade por Módulo" subtitle="Distribuição operacional" /> : <Card className="grid h-[330px] place-items-center border-white/5 bg-[#111111]"><div className="text-center"><Activity className="mx-auto mb-2 h-6 w-6 text-white/10"/><p className="text-xs text-muted-foreground">Sem dados suficientes.</p></div></Card>}
        </motion.div>
      </div>

      {actionChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}>
          <DomnBarChart data={actionChart} title="Atividade por Tipo de Ação" subtitle="Top 9 · últimos 100 eventos" />
        </motion.div>
      )}
    </div>
  );
}
