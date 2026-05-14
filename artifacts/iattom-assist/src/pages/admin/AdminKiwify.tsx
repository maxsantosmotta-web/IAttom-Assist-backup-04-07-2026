import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Package,
  Clock,
  Webhook,
  ShoppingBag,
  UserCheck,
  BadgeX,
  RotateCcw,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";
import { Button } from "@/components/ui/button";

interface KiwifyConfigData {
  configured: boolean;
  storeId?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  accessToken?: string;
  tokenExpiry?: string | null;
  isActive?: boolean;
  updatedAt?: string;
}

interface KiwifyProductItem {
  id: number;
  productId: string;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  price?: string | null;
  currency?: string | null;
  syncedAt?: string | null;
}

interface KiwifyEventItem {
  id: number;
  eventType?: string | null;
  orderId?: string | null;
  productId?: string | null;
  buyerEmail?: string | null;
  buyerName?: string | null;
  value?: string | null;
  currency?: string | null;
  receivedAt?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  "order.approved": <ShoppingBag className="w-3 h-3" />,
  "order.waiting_payment": <CreditCard className="w-3 h-3" />,
  "order.refunded": <RotateCcw className="w-3 h-3" />,
  "order.chargeback": <BadgeX className="w-3 h-3" />,
  "order.canceled": <BadgeX className="w-3 h-3" />,
  "order.abandoned": <AlertCircle className="w-3 h-3" />,
  "subscription.active": <UserCheck className="w-3 h-3" />,
  "subscription.canceled": <BadgeX className="w-3 h-3" />,
};

const EVENT_LABELS: Record<string, string> = {
  "order.approved": "Compra Aprovada",
  "order.waiting_payment": "Aguardando Pagamento",
  "order.refunded": "Reembolso",
  "order.chargeback": "Chargeback",
  "order.canceled": "Cancelado",
  "order.abandoned": "Abandono",
  "subscription.active": "Assinatura Ativa",
  "subscription.canceled": "Assinatura Cancelada",
  "subscription.overdue": "Assinatura Inadimplente",
  "subscription.reactivated": "Assinatura Reativada",
};

const EVENT_COLORS: Record<string, string> = {
  "order.approved": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "order.waiting_payment": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "order.refunded": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "order.chargeback": "bg-red-500/15 text-red-400 border-red-500/30",
  "order.canceled": "bg-red-500/15 text-red-400 border-red-500/30",
  "order.abandoned": "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  "subscription.active": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "subscription.canceled": "bg-red-500/15 text-red-400 border-red-500/30",
  "subscription.overdue": "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export function AdminKiwify() {
  const [config, setConfig] = useState<KiwifyConfigData | null>(null);
  const [products, setProducts] = useState<KiwifyProductItem[]>([]);
  const [events, setEvents] = useState<KiwifyEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [form, setForm] = useState({
    storeId: "",
    clientId: "",
    clientSecret: "",
    webhookSecret: "",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const webhookEndpoint = `${window.location.origin}${BASE}/api/kiwify/webhook`;
  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, prods] = await Promise.all([
        apiFetch<KiwifyConfigData>("/api/kiwify/config"),
        apiFetch<KiwifyProductItem[]>("/api/kiwify/products"),
      ]);
      setConfig(cfg);
      setProducts(prods);
      if (cfg.configured) {
        setForm((f) => ({
          ...f,
          storeId: cfg.storeId ?? "",
          clientId: cfg.clientId ?? "",
        }));
      }
    } catch {
      setConfig({ configured: false });
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await apiFetch<KiwifyEventItem[]>("/api/kiwify/events");
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => { void loadAll(); void loadEvents(); }, []);

  const handleSave = async () => {
    setSaving(true); setSaveStatus("idle");
    try {
      await apiFetch("/api/kiwify/config", { method: "POST", body: JSON.stringify(form) });
      setSaveStatus("ok");
      await loadAll();
    } catch { setSaveStatus("error"); } finally { setSaving(false); }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try { await apiFetch("/api/kiwify/sync-products", { method: "POST" }); await loadAll(); }
    catch { } finally { setSyncingProducts(false); }
  };

  const eventColor = (type: string | null | undefined) =>
    EVENT_COLORS[type ?? ""] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30";
  const eventLabel = (type: string | null | undefined) =>
    EVENT_LABELS[type ?? ""] ?? type ?? "—";

  // stats
  const approved = events.filter((e) => e.eventType === "order.approved").length;
  const pending = events.filter((e) => e.eventType === "order.waiting_payment").length;
  const refunds = events.filter((e) => e.eventType === "order.refunded" || e.eventType === "order.chargeback").length;
  const abandoned = events.filter((e) => e.eventType === "order.abandoned").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Kiwify</h1>
          {config?.isActive
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
            : <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">Não configurado</Badge>}
        </div>
        <p className="text-sm text-zinc-500 ml-8">Integração com a API da Kiwify — produtos digitais, afiliados e assinaturas.</p>
      </motion.div>

      {/* ─── ESTATÍSTICAS DE EVENTOS ──────────────────────────────────── */}
      {events.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Aprovadas", value: approved, color: "text-emerald-400" },
            { label: "Pendentes", value: pending, color: "text-amber-400" },
            { label: "Reembolsos", value: refunds, color: "text-red-400" },
            { label: "Abandonos", value: abandoned, color: "text-zinc-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/3 border border-white/8 rounded-lg px-3 py-3 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── CREDENCIAIS ───────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary/70" />
            Credenciais da API Kiwify
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : (
            <>
              <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                <p className="text-xs font-medium text-primary mb-1.5">Onde encontrar as credenciais</p>
                <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Acesse <strong className="text-zinc-300">app.kiwify.com.br</strong> → Configurações → Integrações → API.</li>
                  <li>Copie o <strong className="text-zinc-300">Store ID</strong>, <strong className="text-zinc-300">Client ID</strong> e <strong className="text-zinc-300">Client Secret</strong>.</li>
                  <li>Em "Webhooks", crie um novo webhook e copie o <strong className="text-zinc-300">Webhook Secret</strong> gerado.</li>
                  <li>Cole a URL do webhook abaixo no campo de URL do painel Kiwify.</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Store ID</label>
                  <input className={inputClass} placeholder="ex: sua_loja_id"
                    value={form.storeId} onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Client ID</label>
                  <input className={inputClass} placeholder="ex: client_abc123"
                    value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Client Secret</label>
                  <div className="relative">
                    <input className={inputClass + " pr-10"} type={showSecret ? "text" : "password"}
                      placeholder={config?.configured ? "Novo secret para substituir" : "xxxxxxxx..."}
                      value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} />
                    <button type="button" onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Webhook Secret</label>
                  <div className="relative">
                    <input className={inputClass + " pr-10"} type={showWebhookSecret ? "text" : "password"}
                      placeholder="ex: whsec_..."
                      value={form.webhookSecret} onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))} />
                    <button type="button" onClick={() => setShowWebhookSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600">Usado para validar a assinatura HMAC-SHA1 dos eventos.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveStatus === "ok" && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Salvo com sucesso.</span>}
                  {saveStatus === "error" && <span className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" />Erro ao salvar.</span>}
                </div>
                <Button size="sm" onClick={() => void handleSave()}
                  disabled={saving || !form.storeId || !form.clientId || (!form.clientSecret && !config?.configured) || !form.webhookSecret}
                  className="bg-primary text-black hover:bg-primary/90 gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? "Salvando..." : "Salvar credenciais"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── WEBHOOK ENDPOINT ─────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary/70" />
            Endpoint do Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">
              {webhookEndpoint}
            </code>
            <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-zinc-500 hover:text-white"
              onClick={() => copyToClipboard(webhookEndpoint)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-1.5">Como configurar no painel Kiwify</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Acesse <strong className="text-zinc-300">app.kiwify.com.br</strong> → Configurações → Webhooks.</li>
              <li>Clique em "Adicionar Webhook".</li>
              <li>Cole a URL acima no campo de URL.</li>
              <li>Selecione os eventos desejados (veja lista abaixo).</li>
              <li>Copie o <strong className="text-zinc-300">Webhook Secret</strong> gerado e salve nas credenciais acima.</li>
              <li>Salve e aguarde os primeiros eventos chegarem.</li>
            </ol>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: "order.approved", label: "Compra Aprovada", color: "emerald" },
              { key: "order.waiting_payment", label: "Aguardando Pagamento", color: "amber" },
              { key: "order.refunded", label: "Reembolso", color: "orange" },
              { key: "order.chargeback", label: "Chargeback", color: "red" },
              { key: "order.abandoned", label: "Abandono", color: "zinc" },
              { key: "subscription.canceled", label: "Assinatura Cancelada", color: "red" },
            ].map((ev) => (
              <div key={ev.key} className="flex items-center gap-1.5 bg-white/2 border border-white/5 rounded-lg px-2.5 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full bg-${ev.color}-400/60 shrink-0`} />
                <span className="text-[10px] text-zinc-500">{ev.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── PRODUTOS ──────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-primary/70" />
              Produtos Digitais
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{products.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void handleSyncProducts()}
              disabled={syncingProducts || !config?.isActive}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs">
              <RefreshCw className={`w-3 h-3 ${syncingProducts ? "animate-spin" : ""}`} />
              {syncingProducts ? "Sincronizando..." : "Sincronizar Produtos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum produto sincronizado. Salve as credenciais e clique em "Sincronizar Produtos".
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name || "—"}</p>
                    <p className="text-[10px] text-zinc-600 font-mono">{p.productId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.type && <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600/30 text-[10px]">{p.type}</Badge>}
                    <span className="text-xs text-zinc-400">R$ {p.price}</span>
                    <Badge className={`text-[10px] ${p.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-zinc-700/40 text-zinc-500 border-zinc-600/30"}`}>
                      {p.status ?? "—"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── LOG DE EVENTOS ────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary/70" />
              Log de Eventos
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{events.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void loadEvents()} disabled={eventsLoading}
              className="h-7 px-2 text-zinc-500 hover:text-white gap-1.5 text-xs">
              <RefreshCw className={`w-3 h-3 ${eventsLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum evento recebido. Configure o webhook no painel Kiwify.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <Badge className={`flex items-center gap-1 text-[10px] shrink-0 ${eventColor(ev.eventType)}`}>
                    {EVENT_ICONS[ev.eventType ?? ""] ?? null}
                    {eventLabel(ev.eventType)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{ev.buyerName || ev.buyerEmail || "—"}</p>
                    {ev.orderId && <p className="text-[10px] text-zinc-600 font-mono">{ev.orderId}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ev.value && <span className="text-xs text-zinc-400">R$ {ev.value}</span>}
                    <span className="text-[10px] text-zinc-600">{formatDate(ev.receivedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IntegrationFutureAutomations
        items={[
          "E-mail de boas-vindas ao comprador",
          "Alerta de chargeback em tempo real",
          "Follow-up de pagamento pendente",
          "Recuperação de abandono de checkout",
          "Relatório de vendas com IA",
          "Gestão de assinaturas canceladas",
          "Notificação de reembolso processado",
          "Análise de conversão por produto",
        ]}
      />
    </div>
  );
}
