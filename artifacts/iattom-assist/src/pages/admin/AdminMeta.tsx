import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Instagram, Facebook, RefreshCw, Loader2, Users, Activity, Clock, BarChart2,
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

interface MetaInstagramAccount {
  id: number;
  igId: string;
  name: string | null;
  username: string | null;
  followersCount: string | null;
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

export function AdminMeta() {
  const [pages, setPages]         = useState<MetaPage[]>([]);
  const [accounts, setAccounts]   = useState<MetaInstagramAccount[]>([]);
  const [events, setEvents]       = useState<MetaEvent[]>([]);
  const [loading, setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesData, accountsData, eventsData] = await Promise.all([
        apiFetch<MetaPage[]>("/api/meta/pages"),
        apiFetch<MetaInstagramAccount[]>("/api/meta/instagram-accounts"),
        apiFetch<MetaEvent[]>("/api/meta/events"),
      ]);
      setPages(pagesData);
      setAccounts(accountsData);
      setEvents(eventsData);
    } catch {
      setPages([]); setAccounts([]); setEvents([]);
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

  const fbEvents   = events.filter(e => e.platform === "facebook").length;
  const igEvents   = events.filter(e => e.platform === "instagram").length;
  const totalAssets = pages.length + accounts.length;

  const kpis = [
    { label: "Recursos Conectados", value: totalAssets > 0 ? String(totalAssets) : "—", icon: Users,    color: "text-blue-400" },
    { label: "Eventos Facebook",    value: fbEvents > 0 ? String(fbEvents) : "—",       icon: Activity, color: "text-blue-400" },
    { label: "Eventos Instagram",   value: igEvents > 0 ? String(igEvents) : "—",       icon: Clock,    color: "text-pink-400" },
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

      {/* ─── Páginas e Contas ──────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500" />
              Páginas e Contas
              {!loading && totalAssets > 0 && (
                <span className="text-[11px] font-normal text-zinc-500">({totalAssets})</span>
              )}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void loadAll()} disabled={loading}
              className="h-7 px-2 text-zinc-600 hover:text-white">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando dados...
            </div>
          ) : totalAssets === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
              <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                <Instagram className="w-4 h-4 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500">Nenhuma conta ou página conectada à Meta.</p>
              <p className="text-[11px] text-zinc-700 max-w-xs">
                As conexões aparecerão aqui após a configuração da integração.
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
              {pages.map(page => (
                <div key={`page-${page.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                    <Facebook className="w-3.5 h-3.5 text-blue-400/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-white truncate">{page.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px] px-1.5 py-0">Facebook Page</Badge>
                      {page.webhookSubscribed && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">Webhook</Badge>
                      )}
                      <span className="text-[10px] text-zinc-600">{fmtDate(page.syncedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {accounts.map(acct => (
                <div key={`acct-${acct.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/15 flex items-center justify-center shrink-0">
                    <Instagram className="w-3.5 h-3.5 text-pink-400/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-white truncate">
                      @{acct.username || acct.name || acct.igId}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-pink-500/15 text-pink-400 border-pink-500/30 text-[9px] px-1.5 py-0">Instagram</Badge>
                      <span className="text-[10px] text-zinc-500">
                        {parseInt(acct.followersCount ?? "0").toLocaleString("pt-BR")} seguidores
                      </span>
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
