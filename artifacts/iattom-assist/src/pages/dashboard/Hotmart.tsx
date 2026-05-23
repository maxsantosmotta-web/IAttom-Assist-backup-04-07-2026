import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Flame, Loader2, ClipboardList,
  RefreshCw, ShoppingBag, DollarSign,
  Package, Megaphone, FolderOpen, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotmartProduct {
  id: number;
  productId: string;
  name?: string | null;
  price?: string | null;
  currency?: string | null;
}

interface HotmartEvent {
  id: number;
  eventType?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  value?: string | null;
  currency?: string | null;
  receivedAt?: string | null;
}

interface SavedCampaign {
  id: string;
  title: string;
  content?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function revenueIn30d(events: HotmartEvent[]): string {
  const cutoff = thirtyDaysAgo();
  const total = events
    .filter(e => e.eventType === "PURCHASE_APPROVED" && e.receivedAt && new Date(e.receivedAt) >= cutoff)
    .reduce((sum, e) => sum + parseFloat(e.value ?? "0"), 0);
  if (total === 0) return "R$ 0";
  return total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function readSavedCampaigns(): SavedCampaign[] {
  try {
    const raw = localStorage.getItem("iattom_hotmart_campaigns_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedCampaign[];
  } catch {
    return [];
  }
}

function downloadCampaign(campaign: SavedCampaign) {
  const text = campaign.content ?? campaign.title;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${campaign.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

const isConnected = false;

// ─── Component ───────────────────────────────────────────────────────────────

export function Hotmart() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [products, setProducts]               = useState<HotmartProduct[]>([]);
  const [events, setEvents]                   = useState<HotmartEvent[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingEvents, setLoadingEvents]     = useState(false);
  const [syncing, setSyncing]                 = useState(false);
  const [savedCampaigns, setSavedCampaigns]   = useState<SavedCampaign[]>([]);
  const [showAdSelector, setShowAdSelector]   = useState(false);

  const handleRefreshCampaigns = useCallback(() => {
    setSavedCampaigns(readSavedCampaigns());
  }, []);

  const handleLoadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const data = await apiFetch<HotmartProduct[]>("/api/hotmart/user/products");
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const handleLoadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch<HotmartEvent[]>("/api/hotmart/user/sales");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    handleRefreshCampaigns();
    if (isConnected) {
      void handleLoadProducts();
      void handleLoadEvents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = () => {
    setSyncing(true);
    handleRefreshCampaigns();
    setTimeout(() => {
      setSyncing(false);
      toast({ description: "Lista de campanhas atualizada." });
    }, 400);
  };

  const handleCreateCampaign = () => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: "", channel: "hotmart" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados carregados na criação de campanha." });
  };

  const handleCreateAd = () => {
    if (savedCampaigns.length === 0) {
      toast({ description: "Nenhuma campanha salva ainda. Crie uma campanha primeiro." });
      return;
    }
    setShowAdSelector(prev => !prev);
  };

  const handleSelectCampaignForAd = (campaign: SavedCampaign) => {
    setShowAdSelector(false);
    window.open("https://app.hotmart.com", "_blank", "noopener,noreferrer");
    toast({ description: `Hotmart aberta. Publique "${campaign.title}" manualmente.` });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cutoff = thirtyDaysAgo();
  const approvedIn30d = events.filter(e =>
    e.eventType === "PURCHASE_APPROVED" && e.receivedAt && new Date(e.receivedAt) >= cutoff
  ).length;
  const approvedSales = events.filter(e => e.eventType === "PURCHASE_APPROVED");

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="space-y-5">

        {/* 1. TOPO */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Hotmart</h1>
              <p className="text-xs text-muted-foreground">Produtos digitais, afiliados e assinaturas</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="border-white/10 text-muted-foreground hover:text-white"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
            Sincronizar
          </Button>
        </div>

        {/* 2. CONECTAR HOTMART */}
        <div className="flex justify-center">
          <Button
            onClick={() => toast({ description: "A Hotmart será aberta quando você for publicar seu anúncio." })}
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-8"
          >
            Conectar Hotmart
          </Button>
        </div>

        {/* 3. CRIAR CAMPANHA */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-400" />
              Criar Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  Crie e organize o material da sua campanha dentro do IAttom antes de publicar.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCreateCampaign}
                className="bg-orange-500 hover:bg-orange-400 text-white font-semibold"
              >
                <ClipboardList className="w-3.5 h-3.5 mr-2" />
                Criar Campanha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 4. PUBLICAR ANÚNCIO HOTMART */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-orange-400" />
              Publicar Anúncio Hotmart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center gap-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  Selecione uma campanha salva e publique seu anúncio diretamente na Hotmart.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateAd}
                className="border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-400/50"
              >
                <Megaphone className="w-3.5 h-3.5 mr-2" />
                Criar Anúncio
              </Button>

              {/* Seletor inline de campanhas */}
              {showAdSelector && (
                <div className="w-full mt-2 rounded-lg border border-white/10 bg-[#0d0d0d] overflow-hidden">
                  <p className="text-xs text-muted-foreground px-4 pt-3 pb-2 border-b border-white/5">
                    Escolha uma campanha para publicar:
                  </p>
                  <div className="divide-y divide-white/5">
                    {savedCampaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => handleSelectCampaignForAd(campaign)}
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                      >
                        {campaign.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. KPIs — um abaixo do outro */}
        <div className="grid grid-cols-1 gap-3">
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Produtos</p>
                <Package className="w-3.5 h-3.5 text-orange-400" />
              </div>
              {loadingProducts
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                : <p className="text-xl font-bold text-white">{products.length}</p>
              }
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Vendas (30d)</p>
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              {loadingEvents
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                : <p className="text-xl font-bold text-white">{approvedIn30d}</p>
              }
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita (30d)</p>
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              {loadingEvents
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                : <p className="text-xl font-bold text-white">{revenueIn30d(events)}</p>
              }
            </CardContent>
          </Card>
        </div>

        {/* 6. VENDAS RECENTES */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                Vendas Recentes
                {approvedSales.length > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                    {approvedSales.filter(e => e.receivedAt && new Date(e.receivedAt) >= thirtyDaysAgo()).length} nos últimos 30d
                  </Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={() => void handleLoadEvents()}
                disabled={loadingEvents}
                className="text-muted-foreground hover:text-white h-7 px-2">
                {loadingEvents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : approvedSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShoppingBag className="w-9 h-9 text-white/8 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhuma venda registrada ainda</p>
                <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs leading-relaxed">
                  As vendas da sua conta Hotmart aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {approvedSales.slice(0, 20).map((ev) => {
                  const date = ev.receivedAt
                    ? new Date(ev.receivedAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : null;
                  const buyer = ev.buyerName ?? ev.buyerEmail ?? "—";
                  const amount = ev.value && parseFloat(ev.value) > 0
                    ? parseFloat(ev.value).toLocaleString("pt-BR", { style: "currency", currency: ev.currency ?? "BRL" })
                    : null;
                  return (
                    <div key={ev.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5 hover:border-white/10 transition-colors">
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs border shrink-0">
                        Aprovada
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{buyer}</p>
                        {date && <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{date}</p>}
                      </div>
                      {amount && (
                        <span className="text-sm font-semibold text-primary shrink-0">{amount}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. CAMPANHAS SALVAS */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              Campanhas Salvas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {savedCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FolderOpen className="w-9 h-9 text-white/8 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhuma campanha salva ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedCampaigns.map((campaign) => (
                  <div key={campaign.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5">
                    <p className="flex-1 text-sm text-white truncate">{campaign.title}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadCampaign(campaign)}
                      className="text-muted-foreground hover:text-white h-7 px-2 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
