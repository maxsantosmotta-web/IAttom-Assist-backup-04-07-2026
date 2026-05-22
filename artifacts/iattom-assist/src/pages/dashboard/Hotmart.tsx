import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Flame, Loader2, ClipboardList,
  RefreshCw, ShoppingBag, DollarSign,
  Package, Megaphone, FolderOpen,
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
    if (isConnected) {
      void handleLoadProducts();
      void handleLoadEvents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!isConnected) {
      toast({ description: "Conecte sua conta Hotmart para sincronizar." });
      return;
    }
    setSyncing(true);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number }>("/api/hotmart/user/sync", { method: "POST" });
      toast({ description: data.synced === 0
        ? "Nenhum produto novo encontrado."
        : `${data.synced} produto(s) atualizados.`
      });
      void handleLoadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao sincronizar.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setSyncing(false);
    }
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
    if (!isConnected) {
      toast({ description: "Crie a campanha no IAttom e conecte sua Hotmart para publicar." });
      return;
    }
    window.open("https://app.hotmart.com/market/ads", "_blank", "noopener,noreferrer");
    toast({ description: "Material organizado. Publique o anúncio na Hotmart." });
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Hotmart</h1>
            <p className="text-xs text-muted-foreground">Produtos digitais, afiliados e assinaturas</p>
          </div>
        </div>

        {/* 2. CONECTAR HOTMART */}
        <div className="flex justify-center">
          <Button
            onClick={() => toast({ description: "Em breve você poderá conectar sua conta Hotmart." })}
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-8"
          >
            Conectar Hotmart
          </Button>
        </div>

        {/* 3. SINCRONIZAR + CRIAR CAMPANHA */}
        <div className="flex justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="border-white/10 text-muted-foreground hover:text-white"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
            Sincronizar
          </Button>
          <Button
            size="sm"
            onClick={handleCreateCampaign}
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold"
          >
            <ClipboardList className="w-3.5 h-3.5 mr-2" />
            Criar Campanha
          </Button>
        </div>

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
                  Crie uma campanha para preparar seu anúncio Hotmart.
                  O IAttom organiza o material — copy, headline, CTA — e abre a Hotmart no local certo para você publicar.
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
                  Conecte sua conta Hotmart para visualizar suas vendas.
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
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FolderOpen className="w-9 h-9 text-white/8 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhuma campanha salva ainda</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs leading-relaxed">
                Suas campanhas criadas aparecerão aqui.
              </p>
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
