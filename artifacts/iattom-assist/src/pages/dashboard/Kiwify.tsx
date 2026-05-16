import { useState } from "react";
import { motion } from "framer-motion";
import {
  Layers, Loader2, X, Info, Package, ClipboardList,
  RefreshCw, ShoppingBag, BarChart2, Save, Eye, EyeOff,
  DollarSign, Tag, ChevronDown, ChevronUp, CheckCircle2,
  Webhook, Copy, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const USER_CREDS_KEY = "iattom_kiwify_user_config_v1";

interface UserKiwifyCreds {
  storeId: string;
  clientId: string;
  savedAt: string;
}

function loadUserCreds(): UserKiwifyCreds | null {
  try {
    const raw = localStorage.getItem(USER_CREDS_KEY);
    return raw ? (JSON.parse(raw) as UserKiwifyCreds) : null;
  } catch {
    return null;
  }
}

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
}: {
  title: string;
  description: string;
  onClose: () => void;
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
        <Button onClick={onClose} className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">
          Entendido
        </Button>
      </motion.div>
    </div>
  );
}

interface KiwifyProduct {
  id: number;
  productId: string;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  price?: string | null;
  currency?: string | null;
}

interface KiwifyEvent {
  id: number;
  eventType?: string | null;
  orderId?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  value?: string | null;
  receivedAt?: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  "order.approved": "Compra Aprovada",
  "order.waiting_payment": "Aguardando Pagamento",
  "order.refunded": "Reembolso",
  "order.chargeback": "Chargeback",
  "order.canceled": "Cancelado",
  "order.abandoned": "Abandono",
  "subscription.active": "Assinatura Ativa",
  "subscription.canceled": "Assinatura Cancelada",
};

const EVENT_COLORS: Record<string, string> = {
  "order.approved": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "order.waiting_payment": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "order.refunded": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "order.chargeback": "bg-red-500/15 text-red-400 border-red-500/30",
  "order.canceled": "bg-red-500/15 text-red-400 border-red-500/30",
  "order.abandoned": "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  "subscription.active": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export function Kiwify() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [savedCreds, setSavedCreds] = useState<UserKiwifyCreds | null>(loadUserCreds);
  const [form, setForm] = useState({ storeId: "", clientId: "", clientSecret: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<KiwifyProduct[]>([]);
  const [events, setEvents] = useState<KiwifyEvent[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);

  const showInfo = (title: string, description: string) => setModal({ title, description });
  const webhookEndpoint = `${window.location.origin}${BASE}/api/kiwify/webhook`;

  const handleSaveCreds = async () => {
    if (!form.storeId || !form.clientId) {
      toast({ variant: "destructive", description: "Store ID e Client ID são obrigatórios." });
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    const creds: UserKiwifyCreds = {
      storeId: form.storeId,
      clientId: form.clientId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(USER_CREDS_KEY, JSON.stringify(creds));
    setSavedCreds(creds);
    setForm({ storeId: "", clientId: "", clientSecret: "" });
    setSaving(false);
    toast({ description: "Credenciais salvas localmente. A sincronização completa estará disponível em breve." });
  };

  const handleLoadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await apiFetch<KiwifyProduct[]>("/api/kiwify/products");
      setProducts(data);
      if (data.length === 0) toast({ description: "Nenhum produto sincronizado ainda. Solicite ao administrador." });
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 401) {
        showInfo(
          "Produtos Kiwify",
          "A listagem de produtos é gerenciada pelo administrador da plataforma. Configure suas credenciais acima e solicite ao administrador que realize a sincronização.",
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
      const data = await apiFetch<KiwifyEvent[]>("/api/kiwify/events");
      setEvents(data);
    } catch {
      toast({ description: "Histórico de eventos disponível após configuração do webhook Kiwify." });
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch<{ ok: boolean; synced: number }>("/api/kiwify/sync-products", { method: "POST" });
      toast({ description: "Sincronização concluída com sucesso." });
      void handleLoadProducts();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 401) {
        showInfo(
          "Sincronização Kiwify",
          "A sincronização de produtos é uma operação administrativa. Solicite ao administrador que realize a sincronização. Após sincronização, os produtos ficam disponíveis aqui.",
        );
      } else {
        toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha na sincronização." });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateCampaign = (product?: KiwifyProduct) => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: product?.name ?? "", channel: "kiwify" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados carregados na criação de campanha." });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    toast({ description: "URL do webhook copiada." });
  };

  return (
    <div className="space-y-6">
      {modal && (
        <InformativeModal title={modal.title} description={modal.description} onClose={() => setModal(null)} />
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Kiwify</h1>
              <p className="text-xs text-muted-foreground">Produtos digitais, afiliados e assinaturas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="border-white/10 text-muted-foreground hover:text-white">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              Sincronizar
            </Button>
            <Button size="sm"
              onClick={() => handleCreateCampaign()}
              className="bg-primary text-black hover:bg-primary/90 font-semibold">
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              Criar Campanha
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Package, label: "Produtos", value: String(products.length), color: "text-primary" },
            { icon: ShoppingBag, label: "Aprovadas", value: String(events.filter((e) => e.eventType === "order.approved").length), color: "text-emerald-400" },
            { icon: BarChart2, label: "Eventos", value: String(events.length), color: "text-blue-400" },
            { icon: CheckCircle2, label: "Credenciais", value: savedCreds ? "Salvas" : "Pendente", color: savedCreds ? "text-emerald-400" : "text-yellow-400" },
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

        {/* Credentials */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                Suas Credenciais Kiwify
              </CardTitle>
              {savedCreds && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Salvas em {new Date(savedCreds.savedAt).toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20">
              <p className="text-xs text-blue-300/80 leading-relaxed">
                Configure suas credenciais Kiwify para personalizar a integração. Acesse <strong className="text-blue-300">app.kiwify.com.br</strong> → Configurações → Integrações → API para obter o Store ID e Client ID.
              </p>
            </div>
            {savedCreds && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">Credenciais configuradas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Store: {savedCreds.storeId} · Client: {savedCreds.clientId}</p>
                </div>
                <Button size="sm" variant="ghost"
                  onClick={() => { localStorage.removeItem(USER_CREDS_KEY); setSavedCreds(null); toast({ description: "Credenciais removidas." }); }}
                  className="ml-auto text-muted-foreground hover:text-red-400 text-xs h-7 px-2">
                  Remover
                </Button>
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Store ID</Label>
                  <Input value={form.storeId}
                    onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                    placeholder="sua_loja_id"
                    className="bg-[#0a0a0a] border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Client ID</Label>
                  <Input value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                    placeholder="client_abc123"
                    className="bg-[#0a0a0a] border-white/10 text-white" />
                </div>
              </div>
              <div className="relative">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Client Secret (opcional)</Label>
                <Input
                  type={showSecret ? "text" : "password"}
                  value={form.clientSecret}
                  onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                  placeholder="••••••••"
                  className="bg-[#0a0a0a] border-white/10 text-white pr-10" />
                <button type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-[calc(50%+8px)] text-muted-foreground hover:text-white transition-colors">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Button onClick={() => void handleSaveCreds()} disabled={saving}
                className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Credenciais
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-muted-foreground" />
              Endpoint do Webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-zinc-300 font-mono break-all">
                {webhookEndpoint}
              </code>
              <Button size="sm" variant="outline"
                onClick={handleCopyWebhook}
                className="border-white/10 text-muted-foreground hover:text-white shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/60">
              Configure esta URL no painel Kiwify → Configurações → Webhooks para receber eventos de compra em tempo real.
            </p>
          </CardContent>
        </Card>

        {/* Products */}
        <Card className="bg-[#111111] border-white/[0.06] mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Produtos Kiwify
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
                  Salve suas credenciais e clique em carregar para ver os produtos Kiwify disponíveis.
                </p>
                <Button size="sm" onClick={() => void handleLoadProducts()} disabled={loadingProducts}
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
                      <Badge className={`text-xs border shrink-0 ${product.status === "active"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}`}>
                        {product.status === "active" ? "Ativo" : product.status ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      {product.price && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-primary">R$ {product.price}</span>
                        </div>
                      )}
                      {product.type && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{product.type}</span>
                        </div>
                      )}
                    </div>
                    <Button size="sm"
                      onClick={() => handleCreateCampaign(product)}
                      className="w-full h-7 bg-primary/80 hover:bg-primary text-black font-semibold text-xs">
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
                  Configure o webhook Kiwify para receber eventos de venda em tempo real.
                </p>
                <Button size="sm" onClick={() => void handleLoadEvents()} variant="outline"
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
                      {ev.orderId && (
                        <p className="text-[10px] text-muted-foreground font-mono">{ev.orderId}</p>
                      )}
                    </div>
                    {ev.value && (
                      <span className="text-xs font-semibold text-primary shrink-0">R$ {ev.value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs futuros */}
        <div>
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Automações e Próximas Funções
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showLogs && (
            <Card className="bg-[#111111] border-white/[0.06] mt-3">
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "E-mail de boas-vindas ao comprador",
                    "Alerta de chargeback em tempo real",
                    "Follow-up de pagamento pendente",
                    "Recuperação de abandono de checkout",
                    "Relatório de vendas com IA",
                    "Análise de conversão por produto",
                    "Notificação de reembolso",
                    "Gestão de assinaturas canceladas",
                  ].map((label) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                      <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground flex-1">{label}</p>
                      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px] shrink-0">Em breve</Badge>
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
