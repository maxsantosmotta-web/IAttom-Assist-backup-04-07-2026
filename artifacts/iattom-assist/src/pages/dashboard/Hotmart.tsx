import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Loader2, X, Info, Package, ClipboardList,
  RefreshCw, ShoppingBag, DollarSign,
  Tag, CheckCircle2, WifiOff, Plus, Minus,
  Link2,
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface HotmartClaim {
  id: number;
  clerkUserId: string;
  productId: string;
  createdAt: string;
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

// ─── Component ───────────────────────────────────────────────────────────────

export function Hotmart() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // products & events (filtered by claims via backend)
  const [products, setProducts]             = useState<HotmartProduct[]>([]);
  const [events, setEvents]                 = useState<HotmartEvent[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingEvents, setLoadingEvents]   = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncError, setSyncError]           = useState<string | null>(null);

  // claims
  const [claimedProducts, setClaimedProducts] = useState<HotmartClaim[]>([]);
  const [loadingClaims, setLoadingClaims]     = useState(true);

  // claim panel
  const [showClaimPanel, setShowClaimPanel]       = useState(false);
  const [availableProducts, setAvailableProducts] = useState<HotmartProduct[]>([]);
  const [loadingAvailable, setLoadingAvailable]   = useState(false);
  const [claimingId, setClaimingId]               = useState<string | null>(null);

  // UI
  const [modal, setModal]                   = useState<{ title: string; description: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [disconnecting, setDisconnecting]   = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // derived
  const isConnected = claimedProducts.length > 0;
  const claimedIds  = new Set(claimedProducts.map(c => c.productId));

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  // ── Loaders ────────────────────────────────────────────────────────────────

  const handleLoadClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
      const data = await apiFetch<HotmartClaim[]>("/api/hotmart/user/claimed-products");
      setClaimedProducts(data);
    } catch {
      setClaimedProducts([]);
    } finally {
      setLoadingClaims(false);
    }
  }, []);

  const handleLoadProducts = useCallback(async () => {
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
  }, [toast]);

  const handleLoadEvents = useCallback(async () => {
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
  }, [toast]);

  const handleLoadAvailable = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const data = await apiFetch<HotmartProduct[]>("/api/hotmart/user/available-products");
      setAvailableProducts(data);
    } catch {
      setAvailableProducts([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  useEffect(() => {
    void handleLoadClaims();
    void handleLoadProducts();
    void handleLoadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Claim panel open ───────────────────────────────────────────────────────

  const handleOpenClaimPanel = () => {
    setShowClaimPanel(true);
    void handleLoadAvailable();
  };

  // ── Claim / unclaim ────────────────────────────────────────────────────────

  const handleClaim = async (productId: string) => {
    setClaimingId(productId);
    try {
      await apiFetch("/api/hotmart/user/claim-product", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
      await handleLoadClaims();
      await handleLoadProducts();
      await handleLoadEvents();
      toast({ description: "Produto vinculado com sucesso." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular produto.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setClaimingId(null);
    }
  };

  const handleUnclaim = async (productId: string) => {
    setClaimingId(productId);
    try {
      await apiFetch(`/api/hotmart/user/claim-product/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      await handleLoadClaims();
      await handleLoadProducts();
      await handleLoadEvents();
      toast({ description: "Vínculo removido." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao remover vínculo.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setClaimingId(null);
    }
  };

  // ── Disconnect — removes ALL claims ───────────────────────────────────────

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setConfirmDisconnect(false);
    try {
      for (const claim of claimedProducts) {
        await apiFetch(`/api/hotmart/user/claim-product/${encodeURIComponent(claim.productId)}`, {
          method: "DELETE",
        });
      }
      setClaimedProducts([]);
      setProducts([]);
      setEvents([]);
      setShowClaimPanel(false);
      toast({ description: "Hotmart desconectada. Dados históricos preservados." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao desconectar.";
      toast({ variant: "destructive", description: msg });
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Sync ───────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!isConnected) {
      toast({ variant: "destructive", description: "Vincule ao menos um produto Hotmart primeiro para sincronizar." });
      return;
    }
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

  // ── Campaign prefill ───────────────────────────────────────────────────────

  const handleCreateCampaign = (product?: HotmartProduct) => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: product?.name ?? "", channel: "hotmart" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados carregados na criação de campanha." });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* Confirm disconnect modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-white">Desconectar Hotmart?</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todos os vínculos de produto serão removidos para sua conta. Produtos e vendas já sincronizados permanecem salvos.
              Você pode reconectar a qualquer momento.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                Desconectar
              </Button>
              <Button
                onClick={() => setConfirmDisconnect(false)}
                variant="outline"
                className="border-white/10 text-muted-foreground hover:text-white"
              >
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
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
              disabled={syncing || !isConnected}
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
              <p className="text-xs font-semibold text-red-400 mb-0.5">Falha na sincronização</p>
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
            {loadingClaims ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando status...</span>
              </div>
            ) : !isConnected ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-semibold text-white">Hotmart desconectada</span>
                </div>
                <p className="text-xs text-muted-foreground/70 flex-1">
                  Vincule ao menos um produto Hotmart para carregar dados reais desta conta.
                </p>
                <Button
                  size="sm"
                  onClick={handleOpenClaimPanel}
                  className="bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs h-7 ml-auto"
                >
                  <Link2 className="w-3 h-3 mr-1.5" />
                  Conectar Hotmart
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Conta conectada</span>
                  <span className="text-xs text-muted-foreground">
                    — {claimedProducts.length} produto{claimedProducts.length !== 1 ? "s" : ""} vinculado{claimedProducts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70 flex-1">
                  Dados filtrados pelos produtos vinculados à sua conta.
                </p>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!showClaimPanel) void handleLoadAvailable();
                      setShowClaimPanel(v => !v);
                    }}
                    className="border-white/10 text-muted-foreground hover:text-white text-xs h-7"
                  >
                    <Package className="w-3 h-3 mr-1.5" />
                    Gerenciar vínculos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showInfo(
                      "Como funciona a integração Hotmart",
                      "Sua conta está vinculada aos produtos que você selecionou da central Hotmart. As vendas chegam automaticamente via webhook e são filtradas pelos seus produtos vinculados. Clique em Sincronizar para atualizar o catálogo.",
                    )}
                    className="border-white/10 text-muted-foreground hover:text-white text-xs h-7"
                  >
                    <Info className="w-3 h-3 mr-1.5" />
                    Como funciona
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={disconnecting}
                    className="border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-400/50 text-xs h-7"
                  >
                    {disconnecting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <WifiOff className="w-3 h-3 mr-1.5" />}
                    Desconectar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim Panel */}
        <AnimatePresence>
          {showClaimPanel && (
            <motion.div
              key="claim-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden mb-5"
            >
              <Card className="bg-[#111111] border-white/[0.06] border-orange-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-orange-400" />
                      Vincular produtos Hotmart
                    </CardTitle>
                    <button
                      onClick={() => setShowClaimPanel(false)}
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione os produtos da central que pertencem à sua conta. Somente esses produtos e seus eventos aparecerão no seu painel.
                  </p>
                </CardHeader>
                <CardContent>
                  {loadingAvailable ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando catálogo...</span>
                    </div>
                  ) : availableProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
                      <Package className="w-9 h-9 text-white/10 mb-1" />
                      <p className="text-sm text-muted-foreground">Nenhum produto disponível na central ainda.</p>
                      <p className="text-xs text-muted-foreground/60">
                        Solicite ao administrador que sincronize o catálogo Hotmart.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableProducts.map((product) => {
                        const isClaimed = claimedIds.has(product.productId);
                        const isLoading = claimingId === product.productId;
                        return (
                          <div
                            key={product.productId}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isClaimed
                                ? "bg-orange-500/5 border-orange-500/20"
                                : "bg-[#0d0d0d] border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-white truncate">
                                  {product.name ?? "Produto sem nome"}
                                </p>
                                {product.status === "ACTIVE" && (
                                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
                                    Ativo
                                  </Badge>
                                )}
                                {isClaimed && (
                                  <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[9px] px-1.5 py-0">
                                    Vinculado
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {product.price && product.price !== "0" && (
                                  <span className="text-xs text-primary font-semibold">R$ {product.price}</span>
                                )}
                                {product.format && (
                                  <span className="text-[10px] text-muted-foreground/70">{product.format}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground/50 font-mono">#{product.productId}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => isClaimed
                                ? void handleUnclaim(product.productId)
                                : void handleClaim(product.productId)
                              }
                              className={`h-7 text-xs shrink-0 ${
                                isClaimed
                                  ? "border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-400/50"
                                  : "border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-400/50"
                              }`}
                            >
                              {isLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isClaimed ? (
                                <><Minus className="w-3 h-3 mr-1" />Remover</>
                              ) : (
                                <><Plus className="w-3 h-3 mr-1" />Vincular</>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

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
            ) : !isConnected ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Conta Hotmart não conectada</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  Vincule ao menos um produto Hotmart para visualizar seus dados reais.
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhum produto sincronizado</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  Clique em "Sincronizar" para buscar seus produtos da API Hotmart.
                </p>
                <Button size="sm" onClick={() => void handleSync()}
                  disabled={syncing}
                  className="mt-4 bg-primary text-black hover:bg-primary/90 font-semibold gap-1.5">
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sincronizar Agora
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
                ) : !isConnected ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <ShoppingBag className="w-9 h-9 text-white/8 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">Conta Hotmart não conectada</p>
                    <p className="text-xs text-muted-foreground/50 mt-1.5 max-w-xs leading-relaxed">
                      Vincule ao menos um produto Hotmart para visualizar suas vendas reais.
                    </p>
                  </div>
                ) : approvedSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <ShoppingBag className="w-9 h-9 text-white/8 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">Nenhuma venda registrada</p>
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
