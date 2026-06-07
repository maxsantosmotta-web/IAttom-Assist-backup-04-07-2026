import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, RefreshCw, Loader2, Activity, Clock, BarChart2, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopeeEvent {
  id: number;
  eventType: string | null;
  shopId: string | null;
  receivedAt: string | null;
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
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminShopee() {
  const [events, setEvents]               = useState<ShopeeEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch<ShopeeEvent[]>("/api/shopee/events");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadEvents]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  const recent24h = events.filter(e => {
    if (!e.receivedAt) return false;
    return Date.now() - new Date(e.receivedAt).getTime() < 24 * 3_600_000;
  }).length;

  const kpis = [
    { label: "Total de Eventos",   value: events.length > 0 ? String(events.length) : "—", icon: Package,   color: "text-orange-400"  },
    { label: "Eventos (24h)",      value: String(recent24h),                                icon: Activity,  color: "text-emerald-400" },
    { label: "Último Evento",      value: events[0]?.receivedAt ? fmtDate(events[0].receivedAt) : "—", icon: Clock, color: "text-amber-400" },
    { label: "Última Atualização", value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: BarChart2, color: "text-zinc-400" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Shopee</h1>
              <p className="text-xs text-zinc-500">Monitoramento de eventos e conexões Shopee.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Monitoramento ativo</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing}
              className="border-white/10 text-zinc-400 hover:text-white h-8 gap-1.5 text-xs"
            >
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

      {/* ─── Eventos Recebidos ──────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-zinc-500" />
              Eventos Recebidos
              {!loadingEvents && events.length > 0 && (
                <span className="text-[11px] font-normal text-zinc-500">
                  ({events.length} {events.length === 1 ? "evento" : "eventos"})
                </span>
              )}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void loadEvents()} disabled={loadingEvents}
              className="h-7 px-2 text-zinc-600 hover:text-white">
              {loadingEvents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingEvents ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <ShoppingBag className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhum evento recebido da Shopee.</p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                Os eventos aparecerão aqui após a configuração do webhook Shopee.
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
              {events.map(evt => (
                <div key={evt.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5 text-orange-400/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[9px] px-1.5 py-0">
                        {evt.eventType ?? "evento"}
                      </Badge>
                      {evt.shopId && (
                        <span className="text-[10px] text-zinc-500">Shop {evt.shopId}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600">{fmtDate(evt.receivedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
