import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flame,
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
  Rocket,
  PlusCircle,
  Send,
  FileText,
  Link,
  Image,
  Info,
  X,
  Tag,
  DollarSign,
  CalendarDays,
  Boxes,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";
import { Button } from "@/components/ui/button";

interface HotmartConfigData {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  basicToken?: string;
  webhookToken?: string;
  environment?: string;
  isActive?: boolean;
  updatedAt?: string;
}

interface HotmartProductItem {
  id: number;
  productId: string;
  name?: string | null;
  format?: string | null;
  status?: string | null;
  price?: string | null;
  currency?: string | null;
  syncedAt?: string | null;
}

interface HotmartEventItem {
  id: number;
  eventType?: string | null;
  transactionId?: string | null;
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
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  PURCHASE_APPROVED: <ShoppingBag className="w-3 h-3" />,
  PURCHASE_BILLET_PRINTED: <CreditCard className="w-3 h-3" />,
  PURCHASE_REFUNDED: <RotateCcw className="w-3 h-3" />,
  PURCHASE_CHARGEBACK: <BadgeX className="w-3 h-3" />,
  PURCHASE_CANCELED: <BadgeX className="w-3 h-3" />,
  PURCHASE_ABANDONED: <AlertCircle className="w-3 h-3" />,
  SUBSCRIPTION_ACTIVE: <UserCheck className="w-3 h-3" />,
  SUBSCRIPTION_CANCELED: <BadgeX className="w-3 h-3" />,
};

const EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED:               "Compra Aprovada",
  PURCHASE_BILLET_PRINTED:         "Boleto/Pix Gerado",
  PURCHASE_REFUNDED:               "Reembolso",
  PURCHASE_CHARGEBACK:             "Chargeback",
  PURCHASE_CANCELED:               "Cancelado",
  PURCHASE_ABANDONED:              "Abandono",
  PURCHASE_COMPLETE:               "Concluída",
  PURCHASE_OUT_OF_SHOPPING_CART:   "Compra fora do carrinho",
  SUBSCRIPTION_ACTIVE:             "Assinatura Ativa",
  SUBSCRIPTION_CANCELED:           "Assinatura Cancelada",
  SUBSCRIPTION_CANCELLATION:       "Assinatura Cancelada",
  SUBSCRIPTION_REACTIVATED:        "Assinatura Reativada",
  SWITCH_PLAN:                     "Troca de plano",
  CLUB_FIRST_ACCESS:               "Primeiro acesso ao clube",
};

function translateHotmartStatus(status: string | null | undefined): string {
  if (!status) return "Não informado";
  const map: Record<string, string> = {
    ACTIVE:  "Ativo",
    INACTIVE: "Inativo",
    paused:  "Pausado",
    active:  "Ativo",
  };
  return map[status] ?? status;
}

const EVENT_COLORS: Record<string, string> = {
  PURCHASE_APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PURCHASE_BILLET_PRINTED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PURCHASE_REFUNDED: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  PURCHASE_CHARGEBACK: "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
  PURCHASE_ABANDONED: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  SUBSCRIPTION_ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  SUBSCRIPTION_CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function AdminHotmart() {
  const [config, setConfig] = useState<HotmartConfigData | null>(null);
  const [products, setProducts] = useState<HotmartProductItem[]>([]);
  const [events, setEvents] = useState<HotmartEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncingProducts, setSyncingProducts] = useState(false);
  interface EndpointDiag {
    label: string;
    url: string;
    status: number;
    bodyEmpty: boolean;
    count: number;
    result: "ok" | "empty" | "error" | "network_error";
    errorDetail?: string;
  }
  const [syncResult, setSyncResult] = useState<{ synced?: number; error?: string; message?: string; diagnostics?: EndpointDiag[] } | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    productId: "",
    format: "Produto próprio",
    status: "ACTIVE",
  });
  const [savingManual, setSavingManual] = useState(false);
  const [manualResult, setManualResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<HotmartProductItem | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({
    title: "",
    description: "",
    price: "",
    creative: "",
    checkoutUrl: "",
  });
  const [offerSaved, setOfferSaved] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    clientSecret: "",
    basicToken: "",
    webhookToken: "",
    environment: "sandbox" as "sandbox" | "production",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [showBasicToken, setShowBasicToken] = useState(false);

  const webhookEndpoint = `${window.location.origin}${BASE}/api/hotmart/webhook`;
  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, prods] = await Promise.all([
        apiFetch<HotmartConfigData>("/api/hotmart/config"),
        apiFetch<HotmartProductItem[]>("/api/hotmart/products"),
      ]);
      setConfig(cfg);
      setProducts(prods);
      if (cfg.configured) {
        setForm((f) => ({
          ...f,
          clientId: cfg.clientId ?? "",
          environment: (cfg.environment as "sandbox" | "production") ?? "sandbox",
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
      const data = await apiFetch<HotmartEventItem[]>("/api/hotmart/events");
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
      await apiFetch("/api/hotmart/config", { method: "POST", body: JSON.stringify(form) });
      setSaveStatus("ok");
      await loadAll();
    } catch { setSaveStatus("error"); } finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const data = await apiFetch<{ ok: boolean; message: string }>("/api/hotmart/test", { method: "POST" });
      setTestResult({ ok: true, message: data.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao testar conexão.";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    setSyncResult(null);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number; message?: string; diagnostics?: EndpointDiag[] }>(
        "/api/hotmart/sync-products",
        { method: "POST" },
      );
      setSyncResult({ synced: data.synced, message: data.message, diagnostics: data.diagnostics });
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar.";
      setSyncResult({ error: msg });
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleAddManual = async () => {
    setSavingManual(true);
    setManualResult(null);
    try {
      await apiFetch("/api/hotmart/products/manual", {
        method: "POST",
        body: JSON.stringify(manualForm),
      });
      setManualResult({ ok: true });
      setShowManualForm(false);
      setManualForm({ name: "", productId: "", format: "Produto próprio", status: "ACTIVE" });
      await loadAll();
    } catch (err) {
      setManualResult({ error: err instanceof Error ? err.message : "Erro ao salvar." });
    } finally {
      setSavingManual(false);
    }
  };

  const eventColor = (type: string | null | undefined) =>
    EVENT_COLORS[type ?? ""] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30";
  const eventLabel = (type: string | null | undefined) =>
    EVENT_LABELS[type ?? ""] ?? type ?? "—";

  // stats
  const approved = events.filter((e) => e.eventType === "PURCHASE_APPROVED").length;
  const pending = events.filter((e) => e.eventType === "PURCHASE_BILLET_PRINTED").length;
  const refunds = events.filter((e) => e.eventType === "PURCHASE_REFUNDED" || e.eventType === "PURCHASE_CHARGEBACK").length;
  const abandoned = events.filter((e) => e.eventType === "PURCHASE_ABANDONED").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Flame className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Hotmart</h1>
          {config?.isActive
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
            : <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">Não configurado</Badge>}
          {config?.environment === "production"
            ? <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">Produção</Badge>
            : config?.configured
              ? <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Sandbox</Badge>
              : null}
        </div>
        <p className="text-sm text-zinc-500 ml-8">Integração com a API da Hotmart — produtos digitais, afiliados e assinaturas.</p>
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
            <Flame className="w-4 h-4 text-primary/70" />
            Credenciais da API Hotmart
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
                  <li>Acesse <strong className="text-zinc-300">app.hotmart.com</strong> → Ferramentas → API & Webhooks.</li>
                  <li>Crie um App ou use existente — copie <strong className="text-zinc-300">Client ID</strong> e <strong className="text-zinc-300">Client Secret</strong>.</li>
                  <li>O <strong className="text-zinc-300">Basic Token</strong> é o Base64 de <code className="text-primary/80">client_id:client_secret</code>.</li>
                  <li>Defina um <strong className="text-zinc-300">Webhook Token</strong> personalizado e insira no campo e também no painel Hotmart.</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Client ID</label>
                  <input className={inputClass} placeholder="ex: abc123..."
                    value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} />
                </div>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Basic Token (Base64)</label>
                  <div className="relative">
                    <input className={inputClass + " pr-10"} type={showBasicToken ? "text" : "password"}
                      placeholder={config?.configured ? "Manter atual" : "base64(client_id:client_secret)"}
                      value={form.basicToken} onChange={(e) => setForm((f) => ({ ...f, basicToken: e.target.value }))} />
                    <button type="button" onClick={() => setShowBasicToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {showBasicToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600">Usado para autenticação OAuth2 na API.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Webhook Token</label>
                  <div className="relative">
                    <input className={inputClass + " pr-10"} type={showWebhookToken ? "text" : "password"}
                      placeholder="ex: meu_token_secreto_hotmart"
                      value={form.webhookToken} onChange={(e) => setForm((f) => ({ ...f, webhookToken: e.target.value }))} />
                    <button type="button" onClick={() => setShowWebhookToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {showWebhookToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600">Configure o mesmo valor no campo "Token" do webhook Hotmart.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Ambiente</label>
                <div className="flex gap-2">
                  {(["sandbox", "production"] as const).map((env) => (
                    <button key={env} type="button"
                      onClick={() => setForm((f) => ({ ...f, environment: env }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${form.environment === env
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-white/3 border-white/10 text-zinc-500 hover:text-zinc-300"}`}>
                      {env === "sandbox" ? "Sandbox (testes)" : "Produção (live)"}
                    </button>
                  ))}
                </div>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  testResult.ok
                    ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/8 border-red-500/20 text-red-300"
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                <div className="flex items-center gap-2">
                  {saveStatus === "ok" && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Salvo.</span>}
                  {saveStatus === "error" && <span className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" />Erro ao salvar.</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="ghost"
                    onClick={() => void handleTestConnection()}
                    disabled={testingConnection || !config?.isActive}
                    className="h-8 px-3 text-zinc-500 hover:text-amber-400 gap-1.5 text-xs border border-white/6 whitespace-nowrap">
                    {testingConnection
                      ? <><Loader2 className="w-3 h-3 animate-spin" />Testando...</>
                      : <><CheckCircle2 className="w-3 h-3" />Testar conexão</>}
                  </Button>
                  <Button size="sm" onClick={() => void handleSave()}
                    disabled={saving || !form.clientId || (!form.clientSecret && !config?.configured) || (!form.basicToken && !config?.configured) || !form.webhookToken}
                    className="bg-primary text-black hover:bg-primary/90 gap-2 whitespace-nowrap">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? "Salvando..." : "Salvar credenciais"}
                  </Button>
                </div>
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
            <p className="text-xs font-medium text-primary mb-1.5">Como configurar no painel Hotmart</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Acesse <strong className="text-zinc-300">app.hotmart.com</strong> → Ferramentas → Webhooks.</li>
              <li>Clique em "+ Adicionar webhook".</li>
              <li>Cole a URL acima no campo de URL.</li>
              <li>No campo "Token", insira o mesmo Webhook Token configurado acima.</li>
              <li>Selecione os eventos: Compra Aprovada, Boleto Impresso, Reembolso, Chargeback, Assinatura.</li>
              <li>Salve e clique em "Testar" para verificar a conexão.</li>
            </ol>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: "PURCHASE_APPROVED", label: "Compra Aprovada", color: "emerald" },
              { key: "PURCHASE_BILLET_PRINTED", label: "Boleto/Pix Gerado", color: "amber" },
              { key: "PURCHASE_REFUNDED", label: "Reembolso", color: "orange" },
              { key: "PURCHASE_CHARGEBACK", label: "Chargeback", color: "red" },
              { key: "PURCHASE_ABANDONED", label: "Abandono", color: "zinc" },
              { key: "SUBSCRIPTION_CANCELED", label: "Assinatura Cancelada", color: "red" },
            ].map((ev) => (
              <div key={ev.key} className="flex items-center gap-1.5 bg-white/2 border border-white/5 rounded-lg px-2.5 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full bg-${ev.color}-400/60 shrink-0`} />
                <span className="text-[10px] text-zinc-500">{ev.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── OFERTAS ───────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
              <Rocket className="w-4 h-4 text-primary/70 shrink-0" />
              Ofertas Hotmart
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{products.length}</Badge>
              {syncResult?.synced !== undefined && syncResult.synced > 0 && (
                <span className="text-[10px] text-emerald-400">{syncResult.synced} importados</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleSyncProducts()}
                disabled={syncingProducts || !config?.isActive}
                className="h-7 px-2 text-zinc-600 hover:text-zinc-400 gap-1 text-[10px] whitespace-nowrap"
              >
                <RefreshCw className={`w-3 h-3 ${syncingProducts ? "animate-spin" : ""}`} />
                {syncingProducts ? "Sincronizando..." : "Sincronizar"}
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowOfferForm(true); setOfferSaved(false); }}
                disabled={!config?.isActive}
                className="h-7 px-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs gap-1.5 whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Criar Oferta Hotmart
              </Button>
            </div>
          </div>
          {syncResult?.error && (
            <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />{syncResult.error}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* ── Manual product form ── */}
          {showManualForm && (
            <div className="mb-4 p-4 bg-white/4 border border-white/10 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-white">Cadastrar produto manualmente</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500">Nome do produto</label>
                  <input
                    className={inputClass}
                    placeholder="Ex: Meu Curso Digital"
                    value={manualForm.name}
                    onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500">ID do produto Hotmart</label>
                  <input
                    className={inputClass}
                    placeholder="Ex: 6095971"
                    value={manualForm.productId}
                    onChange={(e) => setManualForm((f) => ({ ...f, productId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500">Tipo</label>
                  <select
                    className={inputClass}
                    value={manualForm.format}
                    onChange={(e) => setManualForm((f) => ({ ...f, format: e.target.value }))}
                  >
                    <option value="Produto próprio">Produto próprio</option>
                    <option value="Afiliado">Afiliado</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500">Status</label>
                  <select
                    className={inputClass}
                    value={manualForm.status}
                    onChange={(e) => setManualForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              {manualResult?.error && (
                <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{manualResult.error}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => void handleAddManual()}
                  disabled={savingManual || !manualForm.name.trim() || !manualForm.productId.trim()}
                  className="h-7 px-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs gap-1.5"
                >
                  {savingManual ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {savingManual ? "Salvando..." : "Salvar produto"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowManualForm(false); setManualResult(null); }}
                  className="h-7 px-3 text-zinc-500 hover:text-white text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* ── Criar Oferta form ── */}
          {showOfferForm && (
            <div className="mb-4 p-4 bg-white/4 border border-primary/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white flex items-center gap-2">
                  <Rocket className="w-3.5 h-3.5 text-primary" />
                  Nova Oferta Hotmart
                </p>
                <Button size="sm" variant="ghost"
                  onClick={() => { setShowOfferForm(false); setOfferSaved(false); }}
                  className="h-6 w-6 p-0 text-zinc-600 hover:text-white">
                  <BadgeX className="w-3.5 h-3.5" />
                </Button>
              </div>

              {offerSaved ? (
                <div className="flex flex-col items-center py-4 gap-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-medium text-white">Oferta preparada com sucesso.</p>
                  <p className="text-[11px] text-zinc-500">Publicação automática na Hotmart disponível em breve.</p>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setShowOfferForm(false); setOfferSaved(false); }}
                    className="mt-1 h-7 px-3 text-zinc-500 hover:text-white text-xs">
                    Fechar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1"><FileText className="w-3 h-3" />Título da oferta</label>
                      <input className={inputClass} placeholder="Ex: Desbloqueando Sua Energia — Edição Premium"
                        value={offerForm.title}
                        onChange={(e) => setOfferForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1"><FileText className="w-3 h-3" />Descrição</label>
                      <textarea rows={3} className={`${inputClass} resize-none`}
                        placeholder="Descreva o produto, benefícios e para quem é..."
                        value={offerForm.description}
                        onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />Preço (R$)</label>
                      <input className={inputClass} placeholder="Ex: 197,00" type="text"
                        value={offerForm.price}
                        onChange={(e) => setOfferForm((f) => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1"><Link className="w-3 h-3" />URL de checkout</label>
                      <input className={inputClass} placeholder="https://pay.hotmart.com/..."
                        value={offerForm.checkoutUrl}
                        onChange={(e) => setOfferForm((f) => ({ ...f, checkoutUrl: e.target.value }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 flex items-center gap-1"><Image className="w-3 h-3" />Criativo (descrição ou URL da imagem)</label>
                      <input className={inputClass} placeholder="Ex: Banner horizontal fundo escuro, texto dourado"
                        value={offerForm.creative}
                        onChange={(e) => setOfferForm((f) => ({ ...f, creative: e.target.value }))} />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <Button size="sm"
                      disabled={!offerForm.title.trim()}
                      onClick={() => setOfferSaved(true)}
                      className="h-7 px-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs gap-1.5">
                      <Send className="w-3 h-3" />
                      Preparar Oferta
                    </Button>
                    <span className="text-[10px] text-zinc-600">Publicação automática disponível em breve</span>
                  </div>
                </>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Rocket className="w-8 h-8 mx-auto mb-3 text-primary/30" />
              <p className="text-zinc-400 font-medium">Pronto para publicar novos produtos na Hotmart.</p>
              <p className="text-[11px] text-zinc-600 mt-1">Clique em "Criar Oferta Hotmart" para começar.</p>
              {!showManualForm && !showOfferForm && (
                <Button size="sm" variant="ghost"
                  onClick={() => setShowManualForm(true)}
                  className="mt-3 h-7 px-3 text-zinc-600 hover:text-zinc-400 border border-white/8 text-xs gap-1.5">
                  <Save className="w-3 h-3" />
                  Cadastrar ID do produto existente
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {!showManualForm && !showOfferForm && (
                <div className="flex justify-end mb-1">
                  <Button size="sm" variant="ghost"
                    onClick={() => setShowManualForm(true)}
                    className="h-6 px-2 text-zinc-600 hover:text-primary text-[10px] gap-1 border border-white/5 hover:border-primary/30">
                    <Save className="w-3 h-3" />
                    Adicionar manualmente
                  </Button>
                </div>
              )}
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="group flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/5 hover:border-primary/25 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-primary/90 transition-colors">
                      {p.name || "—"}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">{p.productId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.format && (
                      <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600/30 text-[10px] hidden sm:flex">
                        {p.format}
                      </Badge>
                    )}
                    <span className="text-xs text-zinc-400">R$ {p.price}</span>
                    <Badge className={`text-[10px] ${p.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-zinc-700/40 text-zinc-500 border-zinc-600/30"}`}>
                      {translateHotmartStatus(p.status)}
                    </Badge>
                    <Info className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary/60 transition-colors shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── VENDAS ────────────────────────────────────────────────────── */}
      {(() => {
        const sales = events.filter((e) =>
          e.eventType?.startsWith("PURCHASE_") && e.eventType !== "PURCHASE_ABANDONED"
        );
        const totalValue = sales.reduce((acc, e) => acc + (parseFloat(e.value ?? "0") || 0), 0);
        return (
          <Card className="bg-white/3 border-white/8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary/70" />
                Vendas
                <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{sales.length}</Badge>
                {sales.length > 0 && (
                  <span className="text-[10px] text-emerald-400 ml-1">
                    R$ {totalValue.toFixed(2)} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">
                  <ShoppingBag className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  Nenhuma venda recebida via webhook ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.slice(0, 20).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                      <Badge className={`flex items-center gap-1 text-[10px] shrink-0 ${eventColor(ev.eventType)}`}>
                        {EVENT_ICONS[ev.eventType ?? ""] ?? null}
                        {eventLabel(ev.eventType)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{ev.buyerName || ev.buyerEmail || "—"}</p>
                        {ev.transactionId && (
                          <p className="text-[10px] text-zinc-600 font-mono truncate">{ev.transactionId}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.value && <span className="text-xs font-medium text-zinc-300">R$ {ev.value}</span>}
                        <span className="text-[10px] text-zinc-600">{formatDate(ev.receivedAt)}</span>
                      </div>
                    </div>
                  ))}
                  {sales.length > 20 && (
                    <p className="text-center text-[11px] text-zinc-600 pt-1">
                      + {sales.length - 20} eventos adicionais no Log de Eventos
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ─── ASSINATURAS/COMPRAS ────────────────────────────────────────── */}
      {(() => {
        const subs = events.filter((e) => e.eventType?.startsWith("SUBSCRIPTION_"));
        const active = subs.filter((e) => e.eventType === "SUBSCRIPTION_ACTIVE").length;
        const canceled = subs.filter((e) => e.eventType === "SUBSCRIPTION_CANCELED").length;
        return (
          <Card className="bg-white/3 border-white/8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary/70" />
                  Assinaturas / Compras
                  <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{subs.length}</Badge>
                </CardTitle>
                {subs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400">{active} ativas</span>
                    {canceled > 0 && <span className="text-[10px] text-red-400">{canceled} canceladas</span>}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {subs.length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-sm">
                  <UserCheck className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  Nenhum evento de assinatura recebido. Configure os eventos "Assinatura" no webhook.
                </div>
              ) : (
                <div className="space-y-2">
                  {subs.slice(0, 15).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                      <Badge className={`flex items-center gap-1 text-[10px] shrink-0 ${eventColor(ev.eventType)}`}>
                        {EVENT_ICONS[ev.eventType ?? ""] ?? null}
                        {eventLabel(ev.eventType)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{ev.buyerName || ev.buyerEmail || "—"}</p>
                        {ev.productId && (
                          <p className="text-[10px] text-zinc-600 font-mono truncate">Produto: {ev.productId}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">{formatDate(ev.receivedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
              Nenhum evento recebido. Configure o webhook no painel Hotmart.
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
                    {ev.transactionId && <p className="text-[10px] text-zinc-600 font-mono">{ev.transactionId}</p>}
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
          "Follow-up de boleto não pago",
          "Recuperação de abandono de checkout",
          "Relatório de vendas com IA",
          "Gestão de assinaturas canceladas",
          "Notificação de reembolso processado",
          "Análise de conversão por produto",
        ]}
      />

      {/* ─── MODAL DETALHES DA OFERTA ──────────────────────────────────── */}
      {selectedProduct && (() => {
        const p = selectedProduct;
        const relatedSales = events.filter(
          (e) => e.productId === p.productId && e.eventType?.startsWith("PURCHASE_") && e.eventType !== "PURCHASE_ABANDONED"
        );
        const fmt = (d: string | null | undefined) =>
          d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Não informado";
        const val = (v: string | null | undefined) => (v && v.trim() !== "" ? v : "Não informado");

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProduct(null)}
          >
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* panel */}
            <div
              className="relative z-10 w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* header */}
              <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/8">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Rocket className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug">{val(p.name)}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {p.productId}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-zinc-600 hover:text-white transition-colors mt-0.5 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* body */}
              <div className="px-5 py-4 space-y-3">
                {/* grid de campos */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Tag,         label: "Tipo",     value: val(p.format) },
                    { icon: DollarSign,  label: "Preço",    value: p.price && p.price !== "0" ? `${p.currency ?? "BRL"} ${p.price}` : "Não informado" },
                    { icon: Boxes,       label: "Status",   value: null, badge: p.status },
                    { icon: Receipt,     label: "Origem",   value: "Não informado" },
                    { icon: Link,        label: "Checkout", value: "Não informado", span: 2 },
                    { icon: CalendarDays, label: "Sincronizado em", value: fmt(p.syncedAt), span: 2 },
                  ].map(({ icon: Icon, label, value, badge, span }) => (
                    <div
                      key={label}
                      className={`bg-white/3 border border-white/6 rounded-lg px-3 py-2.5 ${span === 2 ? "col-span-2" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3 h-3 text-primary/50 shrink-0" />
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</p>
                      </div>
                      {badge !== undefined ? (
                        <Badge className={`text-[10px] ${badge === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-zinc-700/40 text-zinc-500 border-zinc-600/30"}`}>
                          {translateHotmartStatus(badge)}
                        </Badge>
                      ) : (
                        <p className={`text-xs font-medium leading-snug ${value === "Não informado" ? "text-zinc-600" : "text-white"}`}>
                          {value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* vendas relacionadas */}
                <div className="bg-white/3 border border-white/6 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShoppingBag className="w-3 h-3 text-primary/50 shrink-0" />
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wide">Vendas relacionadas</p>
                    <span className="ml-auto text-[10px] text-zinc-500">{relatedSales.length}</span>
                  </div>
                  {relatedSales.length === 0 ? (
                    <p className="text-xs text-zinc-600">Nenhuma venda registrada para este produto.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {relatedSales.slice(0, 10).map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2 text-[11px]">
                          <Badge className={`text-[9px] shrink-0 ${EVENT_COLORS[ev.eventType ?? ""] ?? "bg-zinc-700/40 text-zinc-500 border-zinc-600/30"}`}>
                            {EVENT_LABELS[ev.eventType ?? ""] ?? ev.eventType ?? "—"}
                          </Badge>
                          <span className="text-zinc-400 truncate flex-1">{ev.buyerName || ev.buyerEmail || "—"}</span>
                          {ev.value && <span className="text-zinc-500 shrink-0">R$ {ev.value}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* footer */}
              <div className="px-5 pb-4 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedProduct(null)}
                  className="h-7 px-4 text-zinc-500 hover:text-white border border-white/8 text-xs"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
