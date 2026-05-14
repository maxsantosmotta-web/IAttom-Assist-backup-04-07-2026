import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Package,
  ClipboardList,
  Clock,
  MessageSquare,
  Link2,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";

interface MLConfigData {
  configured: boolean;
  appId?: string;
  clientSecret?: string;
  accessToken?: string;
  userId?: string;
  siteId?: string;
  redirectUri?: string;
  isActive?: boolean;
  tokenExpiry?: string | null;
  updatedAt?: string;
}

interface MLProductItem {
  id: number;
  mlItemId: string;
  title?: string | null;
  price?: string | null;
  availableQuantity?: number | null;
  status?: string | null;
  permalink?: string | null;
  syncedAt?: string | null;
}

interface MLOrderItem {
  id: number;
  mlOrderId: string;
  status?: string | null;
  totalAmount?: string | null;
  buyerNickname?: string | null;
  syncedAt?: string | null;
}

interface MLEventItem {
  id: number;
  topic?: string | null;
  resource?: string | null;
  userId?: string | null;
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

const SITE_IDS = [
  { value: "MLB", label: "Brasil (MLB)" },
  { value: "MLA", label: "Argentina (MLA)" },
  { value: "MLM", label: "México (MLM)" },
  { value: "MLC", label: "Chile (MLC)" },
  { value: "MCO", label: "Colômbia (MCO)" },
];

export function AdminMercadoLivre() {
  const [config, setConfig] = useState<MLConfigData | null>(null);
  const [products, setProducts] = useState<MLProductItem[]>([]);
  const [orders, setOrders] = useState<MLOrderItem[]>([]);
  const [events, setEvents] = useState<MLEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [form, setForm] = useState({
    appId: "",
    clientSecret: "",
    redirectUri: "",
    siteId: "MLB",
  });
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const isTokenExpired = () => {
    if (!config?.tokenExpiry) return false;
    return new Date(config.tokenExpiry) < new Date();
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, prods, ords] = await Promise.all([
        apiFetch<MLConfigData>("/api/ml/config"),
        apiFetch<MLProductItem[]>("/api/ml/products"),
        apiFetch<MLOrderItem[]>("/api/ml/orders"),
      ]);
      setConfig(cfg);
      setProducts(prods);
      setOrders(ords);
      if (cfg.configured) {
        setForm({
          appId: cfg.appId ?? "",
          clientSecret: "",
          redirectUri: cfg.redirectUri ?? "",
          siteId: cfg.siteId ?? "MLB",
        });
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
      const data = await apiFetch<MLEventItem[]>("/api/ml/events");
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
      await apiFetch("/api/ml/config", { method: "POST", body: JSON.stringify(form) });
      setSaveStatus("ok");
      await loadAll();
    } catch { setSaveStatus("error"); } finally { setSaving(false); }
  };

  const handleGetOAuthUrl = async () => {
    setOauthLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/ml/oauth-url");
      setOauthUrl(data.url);
    } catch { setOauthUrl(null); } finally { setOauthLoading(false); }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try { await apiFetch("/api/ml/sync-products", { method: "POST" }); await loadAll(); }
    catch { } finally { setSyncingProducts(false); }
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try { await apiFetch("/api/ml/sync-orders", { method: "POST" }); await loadAll(); }
    catch { } finally { setSyncingOrders(false); }
  };

  const statusColor = (s: string | null | undefined) => {
    if (!s) return "bg-zinc-700/40 text-zinc-500 border-zinc-600/30";
    const up = s.toLowerCase();
    if (up === "active" || up === "paid" || up === "delivered") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (up === "cancelled" || up === "closed") return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Mercado Livre</h1>
          {config?.isActive
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
            : <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">Não configurado</Badge>}
          {config?.isActive && isTokenExpired() && (
            <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Token expirado</Badge>
          )}
        </div>
        <p className="text-sm text-zinc-500 ml-8">Configure a integração com a API do Mercado Livre via OAuth2.</p>
      </motion.div>

      {/* ─── CREDENCIAIS ───────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary/70" />
            Credenciais do App
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />Carregando...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">App ID (Client ID)</label>
                  <input className={inputClass} placeholder="ex: 123456789"
                    value={form.appId} onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">developers.mercadolivre.com.br → Meus Apps → App ID</p>
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
                  {config?.configured && <p className="text-[10px] text-zinc-600">Secret atual: {config.clientSecret} — deixe em branco para manter.</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">URI de Redirecionamento</label>
                  <input className={inputClass} placeholder="https://seudominio.com/api/ml/oauth-callback"
                    value={form.redirectUri} onChange={(e) => setForm((f) => ({ ...f, redirectUri: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">Deve ser idêntica à cadastrada no painel do ML.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Site</label>
                  <select className={inputClass + " cursor-pointer"} value={form.siteId}
                    onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
                    {SITE_IDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {config?.isActive && config.userId && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-400">Conta conectada — User ID:</span>
                  <code className="text-xs text-emerald-400 font-mono">{config.userId}</code>
                  {config.tokenExpiry && (
                    <span className="ml-auto text-[10px] text-zinc-600">
                      Token expira: {formatDate(config.tokenExpiry)}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveStatus === "ok" && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Salvo com sucesso.</span>}
                  {saveStatus === "error" && <span className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" />Erro ao salvar.</span>}
                </div>
                <Button size="sm" onClick={() => void handleSave()}
                  disabled={saving || !form.appId || (!form.clientSecret && !config?.configured) || !form.redirectUri}
                  className="bg-primary text-black hover:bg-primary/90 gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? "Salvando..." : "Salvar credenciais"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── OAUTH ─────────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary/70" />
            Autorização OAuth2
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-1.5">Como autenticar a conta Mercado Livre</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Salve as credenciais do App acima.</li>
              <li>Clique em "Gerar Link de Autorização".</li>
              <li>Abra o link e autorize com sua conta Mercado Livre.</li>
              <li>O sistema receberá o token automaticamente via callback <code className="text-primary/80">/api/ml/oauth-callback</code>.</li>
              <li>Após autorizar, o User ID e tokens serão salvos automaticamente.</li>
            </ol>
          </div>
          {oauthUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">{oauthUrl}</code>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-zinc-500 hover:text-white" onClick={() => copyToClipboard(oauthUrl)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <a href={oauthUrl} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => void handleGetOAuthUrl()}
            disabled={oauthLoading || !config?.configured}
            className="border border-white/10 text-zinc-400 hover:text-white gap-2">
            {oauthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {oauthUrl ? "Regenerar link" : "Gerar Link de Autorização"}
          </Button>
        </CardContent>
      </Card>

      {/* ─── PRODUTOS ──────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-primary/70" />
              Produtos (Anúncios)
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
              Nenhum produto sincronizado. Autorize a conta e clique em "Sincronizar Produtos".
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.title || "—"}</p>
                    <p className="text-[10px] text-zinc-600 font-mono">{p.mlItemId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">R$ {p.price}</span>
                    <span className="text-[10px] text-zinc-600">{p.availableQuantity} un.</span>
                    <Badge className={`text-[10px] ${statusColor(p.status)}`}>{p.status ?? "—"}</Badge>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-zinc-300 transition-colors" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PEDIDOS ───────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary/70" />
              Pedidos
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{orders.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void handleSyncOrders()}
              disabled={syncingOrders || !config?.isActive}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs">
              <RefreshCw className={`w-3 h-3 ${syncingOrders ? "animate-spin" : ""}`} />
              {syncingOrders ? "Sincronizando..." : "Sincronizar Pedidos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum pedido sincronizado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white font-mono">{o.mlOrderId}</p>
                    <p className="text-[10px] text-zinc-500">{o.buyerNickname}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">R$ {o.totalAmount}</span>
                    <Badge className={`text-[10px] ${statusColor(o.status)}`}>{o.status ?? "—"}</Badge>
                    <span className="text-[10px] text-zinc-600">{formatDate(o.syncedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── EVENTOS ───────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary/70" />
              Notificações Recebidas
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
          {events.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação recebida ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">{ev.topic ?? "—"}</Badge>
                  <span className="text-xs text-zinc-400 font-mono truncate flex-1">{ev.resource ?? "—"}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">{formatDate(ev.receivedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IntegrationFutureAutomations
        items={[
          "Resposta automática a perguntas",
          "Alerta de estoque baixo",
          "Relatório de vendas com IA",
          "Gestão de reputação",
          "Análise de concorrência por categoria",
          "Geração de descrição com IA",
        ]}
      />
    </div>
  );
}
