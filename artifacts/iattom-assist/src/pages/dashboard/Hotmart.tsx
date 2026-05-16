import { useState } from "react";
import { motion } from "framer-motion";
import {
  Flame, Loader2, X, Info, Package, ClipboardList,
  RefreshCw, ShoppingBag, BarChart2, TrendingUp, Link2,
  DollarSign, Tag, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle2, ExternalLink,
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

const EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED: "Compra Aprovada",
  PURCHASE_BILLET_PRINTED: "Boleto Gerado",
  PURCHASE_REFUNDED: "Reembolso",
  PURCHASE_CHARGEBACK: "Chargeback",
  PURCHASE_CANCELED: "Cancelado",
  PURCHASE_ABANDONED: "Abandono",
  SUBSCRIPTION_ACTIVE: "Assinatura Ativa",
  SUBSCRIPTION_CANCELED: "Assinatura Cancelada",
};

const EVENT_COLORS: Record<string, string> = {
  PURCHASE_APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PURCHASE_REFUNDED: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  PURCHASE_CHARGEBACK: "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_ABANDONED: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  SUBSCRIPTION_ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export function Hotmart() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [products, setProducts] = useState<HotmartProduct[]>([]);
  const [events, setEvents] = useState<HotmartEvent[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [modal, setModal] = useState<{ title: string; description: string; action?: { label: string; onClick: () => void } } | null>(null);

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const handleLoadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await apiFetch<HotmartProduct[]>("/api/hotmart/products");
      setProducts(data);
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 401) {
        showInfo(
          "Acesso Restrito",
          "A listagem de produtos Hotmart é gerenciada pelo administrador da plataforma. Solicite ao administrador que sincronize os produtos.",
        );
      } else {
        toast({ variant: "destructive", description: "Não foi possível carregar os produtos." });
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLoadEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await apiFetch<HotmartEvent[]>("/api/hotmart/events");
      setEvents(data);
    } catch {
      toast({ description: "Histórico de eventos disponível após configuração da integração." });
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number }>("/api/hotmart/sync-products", { method: "POST" });
      toast({ description: `Sincronização concluída — ${data.synced} produto(s) atualizados.` });
      void handleLoadProducts();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 401) {
        showInfo(
          "Sincronização Hotmart",
          "A sincronização de produtos é uma operação administrativa. Solicite ao administrador da plataforma que realize a sincronização no painel ADM.",
        );
      } else {
        toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha na sincronização." });
      }
    } finally {
      setSyncing(false);
    }
  };

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

        {/* Status Card */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Integração disponível</span>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Hotmart está integrado à plataforma. Produtos e vendas são gerenciados pelo administrador.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => showInfo(
                  "Como funciona a integração Hotmart",
                  "O administrador da plataforma conectou a conta Hotmart e sincroniza os produtos digitais. Você pode criar campanhas, visualizar produtos disponíveis e acompanhar suas vendas. Para sincronizar novos produtos, solicite ao administrador.",
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Package, label: "Produtos", value: String(products.length), color: "text-orange-400" },
            { icon: ShoppingBag, label: "Vendas (30d)", value: String(events.filter((e) => e.eventType === "PURCHASE_APPROVED").length), color: "text-emerald-400" },
            { icon: BarChart2, label: "Eventos", value: String(events.length), color: "text-blue-400" },
            { icon: TrendingUp, label: "Status", value: "Ativo", color: "text-primary" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="bg-[#111111] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

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
                  Clique no ícone de atualizar para carregar os produtos Hotmart sincronizados.
                </p>
                <Button size="sm" onClick={() => void handleLoadProducts()}
                  disabled={loadingProducts}
                  className="mt-4 bg-primary text-black hover:bg-primary/90 font-semibold">
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

        {/* Vendas */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                Vendas Recentes
                {events.length > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                    {events.filter((e) => e.eventType === "PURCHASE_APPROVED").length} aprovadas
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
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingBag className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhuma venda registrada</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  As vendas aparecem aqui após a configuração do webhook Hotmart.
                </p>
                <Button size="sm" onClick={() => void handleLoadEvents()}
                  variant="outline"
                  className="mt-3 border-white/10 text-muted-foreground hover:text-white text-xs h-7">
                  Verificar vendas
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 10).map((ev) => (
                  <div key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5">
                    <Badge className={`text-xs border shrink-0 ${EVENT_COLORS[ev.eventType ?? ""] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
                      {EVENT_LABELS[ev.eventType ?? ""] ?? ev.eventType ?? "—"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {ev.buyerName ?? ev.buyerEmail ?? "—"}
                      </p>
                      {ev.transactionId && (
                        <p className="text-[10px] text-muted-foreground font-mono">{ev.transactionId}</p>
                      )}
                    </div>
                    {ev.value && (
                      <span className="text-xs font-semibold text-primary shrink-0">
                        R$ {ev.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs collapsible */}
        <div>
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Ações e Automações Futuras
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showLogs && (
            <Card className="bg-[#111111] border-white/[0.06] mt-3">
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: ShoppingBag, label: "E-mail de boas-vindas ao comprador", status: "Em breve" },
                    { icon: AlertCircle, label: "Alerta de chargeback em tempo real", status: "Em breve" },
                    { icon: RefreshCw, label: "Follow-up de pagamento pendente", status: "Em breve" },
                    { icon: TrendingUp, label: "Relatório de vendas com IA", status: "Em breve" },
                    { icon: ExternalLink, label: "Recuperação de abandono de checkout", status: "Em breve" },
                    { icon: Link2, label: "Análise de conversão por produto", status: "Em breve" },
                  ].map(({ icon: Icon, label, status }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground flex-1">{label}</p>
                      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px] shrink-0">{status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>
    </div>
  );
}
