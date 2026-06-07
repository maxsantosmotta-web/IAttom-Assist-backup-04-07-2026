import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Facebook, RefreshCw, Loader2, Users, Activity, Clock, BarChart2, BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaPage {
  id: number;
  pageId: string;
  name: string;
  category: string | null;
  webhookSubscribed: boolean | null;
  syncedAt: string | null;
}

interface MetaEvent {
  id: number;
  platform: string | null;
  eventType: string | null;
  objectId: string | null;
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

export function AdminFacebook() {
  const [pages, setPages]               = useState<MetaPage[]>([]);
  const [events, setEvents]             = useState<MetaEvent[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [refreshing, setRefreshing]     = useState(false);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const data = await apiFetch<MetaPage[]>("/api/meta/pages");
      setPages(data);
    } catch {
      setPages([]);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiFetch<MetaEvent[]>("/api/meta/events");
      setEvents(data.filter(e => e.platform === "facebook"));
    } catch {
      setEvents([]);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPages(), loadEvents()]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadPages, loadEvents]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  const subscribed = pages.filter(p => p.webhookSubscribed).length;

  const kpis = [
    { label: "Páginas Conectadas", value: pages.length > 0 ? String(pages.length) : "—", icon: Users,    color: "text-blue-400"    },
    { label: "Webhook Ativo",      value: String(subscribed),                              icon: Activity, color: subscribed > 0 ? "text-emerald-400" : "text-zinc-500" },
    { label: "Eventos (FB)",       value: events.length > 0 ? String(events.length) : "—", icon: Clock,  color: "text-amber-400"   },
    { label: "Última Atualização", value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: BarChart2, color: "text-zinc-400" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Facebook className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Facebook</h1>
              <p className="text-xs text-zinc-500">Monitoramento de páginas e eventos do Facebook.</p>
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

      {/* ─── Páginas Conectadas ──────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-zinc-500" />
              Páginas Conectadas
              {!loadingPages && pages.length > 0 && (
                <span className="text-[11px] font-normal text-zinc-500">
                  ({pages.length} {pages.length === 1 ? "página" : "páginas"})
                </span>
              )}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void loadPages()} disabled={loadingPages}
              className="h-7 px-2 text-zinc-600 hover:text-white">
              {loadingPages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPages ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando páginas...
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <Facebook className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhuma página do Facebook conectada.</p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                As páginas aparecerão aqui após a configuração da integração Meta.
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
              {pages.map(page => (
                <div key={page.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                    <Facebook className="w-3.5 h-3.5 text-blue-400/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-white truncate">{page.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {page.webhookSubscribed ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">Webhook ativo</Badge>
                      ) : (
                        <Badge className="bg-zinc-500/15 text-zinc-500 border-zinc-500/30 text-[9px] px-1.5 py-0">Sem webhook</Badge>
                      )}
                      {page.category && <span className="text-[10px] text-zinc-600">{page.category}</span>}
                      <span className="text-[10px] text-zinc-600">Sync: {fmtDate(page.syncedAt)}</span>
                    </div>
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
