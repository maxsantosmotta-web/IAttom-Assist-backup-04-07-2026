import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Layers, RefreshCw, CheckCircle2, AlertCircle, Loader2, Zap,
  Megaphone, ClipboardList, BarChart2, Package, TrendingUp, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface KiwifyConfigStatus {
  configured:       boolean;
  connectionStatus: "not_configured" | "configured" | "validated";
  isActive?:        boolean;
}

interface KiwifyProduct {
  id:         number;
  productId:  string;
  name:       string | null;
  type:       string | null;
  status:     string | null;
  price:      string | null;
  currency:   string | null;
  syncedAt:   string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Kiwify() {
  const { toast } = useToast();

  const [config, setConfig]                   = useState<KiwifyConfigStatus | null>(null);
  const [products, setProducts]               = useState<KiwifyProduct[]>([]);
  const [loadingStatus, setLoadingStatus]     = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [syncing, setSyncing]                 = useState(false);
  const [isRefreshing, setIsRefreshing]       = useState(false);

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/kiwify/config`, { credentials: "include" });
      if (res.ok) setConfig((await res.json()) as KiwifyConfigStatus);
    } catch {
      // silent
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${BASE}/api/kiwify/products`, { credentials: "include" });
      if (res.ok) setProducts((await res.json()) as KiwifyProduct[]);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadConfig(), loadProducts()]);
    setIsRefreshing(false);
  }, [loadConfig, loadProducts]);

  useEffect(() => { void handleRefresh(); }, [handleRefresh]);

  // ── Sync ─────────────────────────────────────────────────────────────────────

  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${BASE}/api/kiwify/sync-products`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ variant: "destructive", description: body.error ?? "Falha ao sincronizar produtos." });
        return;
      }
      const data = (await res.json()) as { ok: boolean; synced?: number };
      toast({ description: `${data.synced ?? 0} produto(s) sincronizado(s) com sucesso.` });
      await loadProducts();
    } catch {
      toast({ variant: "destructive", description: "Erro ao sincronizar com a Kiwify." });
    } finally {
      setSyncing(false);
    }
  };

  // ── Prefill navigation (correct sessionStorage keys) ─────────────────────────

  const handleCriarCampanha = (product?: KiwifyProduct) => {
    if (product) {
      sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({
        product:  product.name ?? product.productId,
        platform: "kiwify",
      }));
    }
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = (product?: KiwifyProduct) => {
    if (product) {
      sessionStorage.setItem("iattom_restore_content_v1", JSON.stringify({
        briefing: {
          topic:             product.name ?? product.productId,
          additionalContext: `Produto Kiwify${product.type ? ` — ${product.type}` : ""}${product.price ? ` — R$ ${product.price}` : ""}`,
        },
      }));
    }
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  const handleCriarAnuncio = () => {
    window.open("https://app.kiwify.com.br/", "_blank", "noopener,noreferrer");
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isConfigured = config?.configured ?? false;
  const isValidated  = config?.connectionStatus === "validated";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Kiwify</h1>
              <p className="text-xs text-muted-foreground">Gerencie produtos, campanhas e suas vendas na Kiwify</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="border-white/10 text-zinc-400 hover:text-white gap-1.5 text-xs">
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
            <Button
              onClick={() => void handleSyncProducts()}
              disabled={syncing || !isConfigured}
              size="sm"
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
            >
              {syncing
                ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                : <Zap className="w-3.5 h-3.5 mr-2" />}
              {syncing ? "Sincronizando..." : "Sincronizar Produtos"}
            </Button>
          </div>
        </div>

        {/* ── Status Card ──────────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {loadingStatus ? (
                <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
              ) : isValidated ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {loadingStatus
                    ? "Verificando integração..."
                    : isValidated
                      ? "Integração Kiwify ativa"
                      : isConfigured
                        ? "Credenciais configuradas — teste de conexão pendente"
                        : "Integração não configurada"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {isValidated
                    ? `${products.length} produto(s) sincronizado(s). Selecione um produto para gerar campanha ou conteúdo.`
                    : "Configure as credenciais em ADM → Integrações → Kiwify."}
                </p>
              </div>
              {isValidated && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] ml-auto shrink-0">
                  Conectado
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Feature Cards ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Anúncios */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Anúncios</CardTitle>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Acompanhe suas campanhas da Kiwify. Visualizações, alcance e conversões disponíveis após conexão.
              </p>
              <div className="grid grid-cols-3 gap-2 py-1">
                {[
                  { icon: BarChart2, label: "Visualizações", value: "—" },
                  { icon: Package,   label: "Alcance",       value: "—" },
                  { icon: TrendingUp,label: "Conversões",    value: "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2 rounded bg-white/5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-white">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" disabled
                className="w-full border-white/10 text-muted-foreground h-8 text-xs opacity-50 cursor-not-allowed">
                <BarChart2 className="w-3 h-3 mr-1.5" />
                Ver análise
              </Button>
            </CardContent>
          </Card>

          {/* Conteúdo */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Conteúdo</CardTitle>
                  <p className="text-xs text-muted-foreground">Publicações</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crie conteúdos e campanhas utilizando os módulos centrais da plataforma.
              </p>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCriarCampanha()}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs">
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  Criar campanha
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCriarConteudo()}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs">
                  <ClipboardList className="w-3 h-3 mr-1.5" />
                  Criar conteúdo
                </Button>
                <Button size="sm" variant="outline" onClick={handleCriarAnuncio}
                  className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-8 text-xs">
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  Criar anúncio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Produtos Kiwify — full-width */}
          <Card className="bg-[#111111] border-white/[0.06] md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-white">Produtos Kiwify</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {products.length > 0
                        ? `${products.length} produto(s) sincronizado(s) — selecione para usar como contexto`
                        : "Sincronize para ver e usar seus produtos"}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void loadProducts()} disabled={loadingProducts}
                  className="h-7 px-2 text-zinc-600 hover:text-white">
                  {loadingProducts
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm px-5 py-6">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />Carregando produtos...
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-5">
                  <div className="w-10 h-10 rounded-full bg-white/3 border border-white/8 flex items-center justify-center mb-1">
                    <Package className="w-4 h-4 text-zinc-700" />
                  </div>
                  <p className="text-sm text-zinc-500">Nenhum produto sincronizado.</p>
                  <p className="text-[11px] text-zinc-700 max-w-xs">
                    {isConfigured
                      ? "Clique em Sincronizar Produtos para importar sua lista da Kiwify."
                      : "Configure a integração em ADM → Integrações → Kiwify primeiro."}
                  </p>
                  {isConfigured && (
                    <Button size="sm" onClick={() => void handleSyncProducts()} disabled={syncing}
                      className="mt-2 bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5">
                      {syncing
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Zap className="w-3 h-3" />}
                      Sincronizar agora
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
                  {products.map(product => (
                    <div key={product.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-violet-400/70" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-white truncate">
                          {product.name || product.productId}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {product.status && (
                            <Badge className={`text-[9px] px-1.5 py-0 ${
                              product.status === "active"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                            }`}>
                              {product.status}
                            </Badge>
                          )}
                          {product.type && (
                            <span className="text-[10px] text-zinc-500">{product.type}</span>
                          )}
                          {product.price && (
                            <span className="text-[10px] text-zinc-400">
                              {product.currency ?? "BRL"} {product.price}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="ghost"
                          onClick={() => handleCriarCampanha(product)}
                          className="h-7 px-2.5 text-zinc-500 hover:text-white border border-white/8 hover:border-white/20 text-[11px] gap-1">
                          <Megaphone className="w-3 h-3" />
                          Campanha
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => handleCriarConteudo(product)}
                          className="h-7 px-2.5 text-zinc-500 hover:text-white border border-white/8 hover:border-white/20 text-[11px] gap-1">
                          <ClipboardList className="w-3 h-3" />
                          Conteúdo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Análise */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Análise</CardTitle>
                  <p className="text-xs text-muted-foreground">Performance e métricas</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Acompanhe visualizações, engajamento e desempenho diretamente na plataforma.
              </p>
              <div className="grid grid-cols-2 gap-2 py-1">
                {[
                  { icon: Package,    label: "Produtos",    value: loadingProducts ? "—" : String(products.length) },
                  { icon: TrendingUp, label: "Conversões",  value: "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2 rounded bg-white/5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-white">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" disabled
                className="w-full border-white/10 text-muted-foreground h-8 text-xs opacity-50 cursor-not-allowed">
                <TrendingUp className="w-3 h-3 mr-1.5" />
                Ver análise
              </Button>
            </CardContent>
          </Card>

        </div>
      </motion.div>
    </div>
  );
}
