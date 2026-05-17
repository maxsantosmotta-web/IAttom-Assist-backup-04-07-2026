import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flame, Loader2, X, Info, Package, ClipboardList,
  RefreshCw, ShoppingBag, DollarSign,
  Tag, CheckCircle2, WifiOff,
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

function InformativeModal({
  title,
  description,
  onClose,
  action,
}: {
  title: string;
  description: string;
  onClose: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Info className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex gap-2">
          {action && (
            <Button onClick={() => { action.onClick(); onClose(); }}
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold">
              {action.label}
            </Button>
          )}
          <Button onClick={onClose}
            variant={action ? "outline" : "default"}
            className={action
              ? "border-white/10 text-muted-foreground hover:text-white"
              : "w-full bg-primary text-black hover:bg-primary/90 font-semibold"}>
            {action ? "Fechar" : "Entendido"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

interface HotmartProduct {
  id: number;
  productId: string;
  name?: string | null;
  format?: string | null;
  status?: string | null;
  price?: string | null;
  currency?: string | null;
  syncedAt?: string | null;
}

interface HotmartEvent {
  id: number;
  eventType?: string | null;
  transactionId?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  value?: string | null;
  currency?: string | null;
  receivedAt?: string | null;
}


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

export function Hotmart() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [products, setProducts] = useState<HotmartProduct[]>([]);
  const [events, setEvents] = useState<HotmartEvent[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string; description: string; action?: { label: string; onClick: () => void } } | null>(null);

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const handleLoadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await apiFetch<HotmartProduct[]>("/api/hotmart/user/products");
      setProducts(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar produtos.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLoadEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch<HotmartEvent[]>("/api/hotmart/user/sales");
      setEvents(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar vendas.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number }>("/api/hotmart/user/sync", { method: "POST" });
      if (data.synced === 0) {
        toast({ description: "Sincronização concluída — nenhum produto novo encontrado." });
      } else {
        toast({ description: `Sincronização concluída — ${data.synced} produto(s) atualizados.` });
      }
      void handleLoadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na sincronização.";
      setSyncError(msg);
      toast({ variant: "destructive", description: msg });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void handleLoadProducts();
    void handleLoadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCampaign = (product?: HotmartProduct) => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: product?.name ?? "", channel: "hotmart" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados carregados na criação de campanha." });
  };

  return (
    <div className="space-y-6">
      {modal && (
        <InformativeModal
          title={modal.title}
          description={modal.description}
          action={modal.action}
          onClose={() => setModal(null)}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Hotmart</h1>
              <p className="text-xs text-muted-foreground">Produtos digitais, afiliados e assinaturas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => handleCreateCampaign()}
              className="bg-orange-500 hover:bg-orange-400 text-white font-semibold"
            >
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              Criar Campanha
            </Button>
          </div>
        </div>

        {/* Sync error banner */}
        {syncError && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/8 border border-red-500/20 mb-5">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-400 mb-0.5">Falha na conexão com a Hotmart</p>
              <p className="text-xs text-red-400/70 leading-relaxed">{syncError}</p>
            </div>
            <button onClick={() => setSyncError(null)} className="text-red-400/50 hover:text-red-400 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Status Card */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Integração ativa</span>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Conectada via credenciais da plataforma. Produtos e vendas são carregados diretamente da API Hotmart.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => showInfo(
                  "Como funciona a integração Hotmart",
                  "Os produtos são sincronizados diretamente da API Hotmart. Clique em Sincronizar para buscar novos produtos. As vendas chegam via webhook Hotmart e são exibidas em tempo real.",
                )}
                className="border-white/10 text-muted-foreground hover:text-white ml-auto text-xs h-7"
              >
                <Info className="w-3 h-3 mr-1.5" />
                Como funciona
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {(() => {
          const cutoff = thirtyDaysAgo();
          const approvedIn30d = events.filter(e => e.eventType === "PURCHASE_APPROVED" && e.receivedAt && new Date(e.receivedAt) >= cutoff).length;
          const kpis = [
            { icon: Package,     label: "Produtos",     value: String(products.length), color: "text-orange-400", loading: loadingProducts },
            { icon: ShoppingBag, label: "Vendas (30d)",  value: String(approvedIn30d),   color: "text-emerald-400", loading: loadingEvents },
            { icon: DollarSign,  label: "Receita (30d)", value: revenueIn30d(events),    color: "text-primary",    loading: loadingEvents },
          ];
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {kpis.map(({ icon: Icon, label, value, color, loading }) => (
                <Card key={label} className="bg-[#111111] border-white/[0.06]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <p className="text-xl font-bold text-white">{value}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })()}

        {/* Products */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Produtos Hotmart
                {products.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{products.length}</Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={() => void handleLoadProducts()}
                disabled={loadingProducts}
                className="text-muted-foreground hover:text-white h-7 px-2">
                {loadingProducts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhum produto carregado</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  Clique em "Carregar Produtos" para buscar seus produtos diretamente da API Hotmart.
                </p>
                <Button size="sm" onClick={() => void handleSync()}
                  disabled={syncing}
                  className="mt-4 bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5">
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Carregar Produtos
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {products.map((product) => (
                  <div key={product.id}
                    className="bg-[#0d0d0d] border border-white/5 rounded-lg p-4 space-y-3 hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                        {product.name ?? "Sem título"}
                      </p>
                      <Badge className={`text-xs border shrink-0 ${product.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}`}>
                        {product.status === "ACTIVE" ? "Ativo" : product.status ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-primary">
                          {product.price ? `R$ ${product.price}` : "—"}
                        </span>
                      </div>
                      {product.format && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{product.format}</span>
                        </div>
                      )}
                    </div>
                    <Button size="sm"
                      onClick={() => handleCreateCampaign(product)}
                      className="w-full h-7 bg-orange-500/80 hover:bg-orange-500 text-white font-semibold text-xs">
                      <ClipboardList className="w-3 h-3 mr-1.5" />
                      Criar Campanha
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendas Recentes */}
        {(() => {
          const approvedSales = events.filter(e => e.eventType === "PURCHASE_APPROVED");
          return (
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
                    <p className="text-sm font-semibold text-muted-foreground">Aguardando eventos reais da Hotmart</p>
                    <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs leading-relaxed">
                      As vendas aprovadas aparecerão aqui assim que o webhook Hotmart estiver ativo e recebendo dados reais.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvedSales.slice(0, 20).map((ev) => {
                      const date = ev.receivedAt
                        ? new Date(ev.receivedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
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
          );
        })()}
      </motion.div>
    </div>
  );
}
