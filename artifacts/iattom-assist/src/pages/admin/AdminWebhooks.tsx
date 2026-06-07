import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Webhook, RefreshCw, Loader2, Activity, Clock, BarChart2, Package, Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookEvent {
  id: string;
  platform: string;
  eventType: string | null;
  label: string;
  detail: string | null;
  receivedAt: string | null;
}

type PlatformFilter = "all" | "kiwify" | "hotmart" | "shopee" | "facebook" | "instagram";

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

const PLATFORM_BADGE: Record<string, string> = {
  kiwify:   "text-violet-400 bg-violet-500/15 border-violet-500/30",
  hotmart:  "text-red-400 bg-red-500/15 border-red-500/30",
  shopee:   "text-orange-400 bg-orange-500/15 border-orange-500/30",
  facebook: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  instagram:"text-pink-400 bg-pink-500/15 border-pink-500/30",
};

const PLATFORM_DOT: Record<string, string> = {
  kiwify:   "bg-violet-500/10 border-violet-500/15",
  hotmart:  "bg-red-500/10 border-red-500/15",
  shopee:   "bg-orange-500/10 border-orange-500/15",
  facebook: "bg-blue-500/10 border-blue-500/15",
  instagram:"bg-pink-500/10 border-pink-500/15",
};

const PLATFORM_ICON_COLOR: Record<string, string> = {
  kiwify:   "text-violet-400/60",
  hotmart:  "text-red-400/60",
  shopee:   "text-orange-400/60",
  facebook: "text-blue-400/60",
  instagram:"text-pink-400/60",
};

// ─── Raw event types ──────────────────────────────────────────────────────────

interface KiwifyRaw   { id: number; eventType: string | null; orderId: string | null; buyerEmail: string | null; buyerName: string | null; value: string | null; receivedAt: string | null }
interface HotmartRaw  { id: number; eventType: string | null; buyerEmail: string | null; buyerName: string | null; value: string | null; receivedAt: string | null }
interface ShopeeRaw   { id: number; eventType: string | null; shopId: string | null; receivedAt: string | null }
interface MetaRaw     { id: number; platform: string | null; eventType: string | null; objectId: string | null; receivedAt: string | null }

// ─── Component ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: PlatformFilter; label: string }[] = [
  { key: "all",       label: "Todos"     },
  { key: "kiwify",    label: "Kiwify"    },
  { key: "hotmart",   label: "Hotmart"   },
  { key: "shopee",    label: "Shopee"    },
  { key: "facebook",  label: "Facebook"  },
  { key: "instagram", label: "Instagram" },
];

export function AdminWebhooks() {
  const [events, setEvents]           = useState<WebhookEvent[]>([]);
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<PlatformFilter>("all");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, hRes, sRes, mRes] = await Promise.allSettled([
        apiFetch<KiwifyRaw[]>("/api/kiwify/events"),
        apiFetch<HotmartRaw[]>("/api/hotmart/events"),
        apiFetch<ShopeeRaw[]>("/api/shopee/events"),
        apiFetch<MetaRaw[]>("/api/meta/events"),
      ]);

      const merged: WebhookEvent[] = [];

      if (kRes.status === "fulfilled") {
        for (const e of kRes.value) {
          merged.push({
            id: `k-${e.id}`,
            platform: "kiwify",
            eventType: e.eventType,
            label: e.buyerName ?? e.buyerEmail ?? `Pedido ${e.orderId ?? e.id}`,
            detail: e.value ? `R$ ${e.value}` : null,
            receivedAt: e.receivedAt,
          });
        }
      }

      if (hRes.status === "fulfilled") {
        for (const e of hRes.value) {
          merged.push({
            id: `h-${e.id}`,
            platform: "hotmart",
            eventType: e.eventType,
            label: e.buyerName ?? e.buyerEmail ?? `Evento #${e.id}`,
            detail: e.value ? `R$ ${e.value}` : null,
            receivedAt: e.receivedAt,
          });
        }
      }

      if (sRes.status === "fulfilled") {
        for (const e of sRes.value) {
          merged.push({
            id: `s-${e.id}`,
            platform: "shopee",
            eventType: e.eventType,
            label: e.shopId ? `Shop ${e.shopId}` : `Evento #${e.id}`,
            detail: null,
            receivedAt: e.receivedAt,
          });
        }
      }

      if (mRes.status === "fulfilled") {
        for (const e of mRes.value) {
          merged.push({
            id: `m-${e.id}`,
            platform: e.platform ?? "meta",
            eventType: e.eventType,
            label: e.objectId ? `Object ${e.objectId}` : `Evento #${e.id}`,
            detail: null,
            receivedAt: e.receivedAt,
          });
        }
      }

      merged.sort((a, b) => {
        const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return tb - ta;
      });

      setEvents(merged);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadAll]);

  useEffect(() => { void handleRefreshAll(); }, [handleRefreshAll]);

  const filtered = filter === "all" ? events : events.filter(e => e.platform === filter);

  const byPlatform = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.platform] = (acc[e.platform] ?? 0) + 1;
    return acc;
  }, {});

  const recent24h = events.filter(e => {
    if (!e.receivedAt) return false;
    return Date.now() - new Date(e.receivedAt).getTime() < 24 * 3_600_000;
  }).length;

  const kpis = [
    { label: "Total de Eventos",   value: events.length > 0 ? String(events.length) : "—", icon: Package,   color: "text-primary"      },
    { label: "Eventos (24h)",      value: String(recent24h),                                icon: Activity,  color: "text-emerald-400"  },
    { label: "Plataformas",        value: String(Object.keys(byPlatform).length),           icon: BarChart2, color: "text-violet-400"   },
    { label: "Última Atualização", value: lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—", icon: Clock, color: "text-zinc-400" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Webhook className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Histórico de Webhooks</h1>
              <p className="text-xs text-zinc-500">Todos os eventos recebidos por todas as plataformas.</p>
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

      {/* ─── Eventos ─────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-zinc-500" />
              Eventos Recebidos
              {!loading && filtered.length > 0 && (
                <span className="text-[11px] font-normal text-zinc-500">
                  ({filtered.length} {filtered.length === 1 ? "evento" : "eventos"})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3 h-3 text-zinc-600 shrink-0" />
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    filter === opt.key
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "text-zinc-500 border-white/8 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {opt.label}
                  {opt.key !== "all" && byPlatform[opt.key] ? ` (${byPlatform[opt.key]})` : ""}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando eventos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <Webhook className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhum evento de webhook recebido.</p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                Os eventos aparecerão aqui assim que as plataformas enviarem dados.
              </p>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto divide-y divide-white/5">
              {filtered.map(evt => {
                const badgeClass   = PLATFORM_BADGE[evt.platform]   ?? "text-zinc-400 bg-zinc-500/15 border-zinc-500/30";
                const dotClass     = PLATFORM_DOT[evt.platform]     ?? "bg-white/5 border-white/10";
                const iconColor    = PLATFORM_ICON_COLOR[evt.platform] ?? "text-zinc-600";
                return (
                  <div key={evt.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${dotClass}`}>
                      <Webhook className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-white truncate">{evt.label}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] px-1.5 py-0 ${badgeClass}`}>
                          {evt.platform}
                        </Badge>
                        {evt.eventType && (
                          <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[9px] px-1.5 py-0">
                            {evt.eventType}
                          </Badge>
                        )}
                        {evt.detail && (
                          <span className="text-[10px] text-zinc-500">{evt.detail}</span>
                        )}
                        <span className="text-[10px] text-zinc-600">{fmtDate(evt.receivedAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
