import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Instagram, RefreshCw, Loader2, Users, Activity, Clock, BarChart2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaEventItem {
  id: number;
  eventType?: string | null;
  pageId?: string | null;
  senderId?: string | null;
  receivedAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminMeta() {
  const [events, setEvents]               = useState<MetaEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try { setEvents(await apiFetch<MetaEventItem[]>("/api/meta/events")); }
    catch { setEvents([]); }
    finally { setLoadingEvents(false); }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadEvents]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  const kpis = [
    { label: "Usuários Conectados", value: "—", icon: Users,    color: "text-blue-400"    },
    { label: "Conexões Ativas",     value: "—", icon: Activity, color: "text-emerald-400" },
    { label: "Tokens Expirando",    value: "—", icon: Clock,    color: "text-amber-400"   },
    { label: "Última Atualização",  value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: BarChart2, color: "text-zinc-400" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Instagram className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Meta — Instagram & Facebook</h1>
              <p className="text-xs text-zinc-500">Monitoramento de conexões dos usuários com a Meta.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Monitoramento ativo</Badge>
            <Button size="sm" variant="outline"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing}
              className="border-white/10 text-zinc-400 hover:text-white h-8 gap-1.5 text-xs">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ─── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-white/3 border-white/8">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-tight">{label}</p>
                <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Usuários Conectados ──────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            Usuários Conectados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
              <Instagram className="w-4 h-4 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-500">Nenhum usuário conectado à Meta.</p>
            <p className="text-[11px] text-zinc-700">As conexões aparecerão aqui após o usuário autenticar sua conta.</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Eventos ─────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-500" />
              Eventos Recentes (Webhooks)
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void loadEvents()} disabled={loadingEvents}
              className="h-7 px-2 text-zinc-600 hover:text-white">
              {loadingEvents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEvents ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">
              Nenhum evento registrado. Os webhooks da Meta aparecerão aqui.
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto divide-y divide-white/5">
              {events.slice(0, 50).map(ev => (
                <div key={ev.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{ev.eventType ?? "—"}</p>
                    {ev.pageId && <p className="text-[10px] text-zinc-500 font-mono">Page: {ev.pageId}</p>}
                    {ev.senderId && <p className="text-[10px] text-zinc-600 font-mono">Sender: {ev.senderId}</p>}
                  </div>
                  <p className="text-[10px] text-zinc-600 shrink-0 pt-0.5">{fmtDate(ev.receivedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
