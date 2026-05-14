import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";

interface ShopeeConfigData {
  configured: boolean;
  partnerId?: string;
  partnerKey?: string;
  shopId?: string;
  accessToken?: string;
  redirectUrl?: string;
  isActive?: boolean;
  tokenExpiry?: string | null;
  updatedAt?: string;
}

interface ShopeeProductItem {
  id: number;
  itemId: string;
  name?: string | null;
  price?: string | null;
  stock?: number | null;
  status?: string | null;
  syncedAt?: string | null;
}

interface ShopeeOrderItem {
  id: number;
  orderSn: string;
  status?: string | null;
  totalPrice?: string | null;
  buyerUsername?: string | null;
  syncedAt?: string | null;
}

interface ShopeeEventItem {
  id: number;
  eventType?: string | null;
  shopId?: string | null;
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

export function AdminShopee() {
  const [config, setConfig] = useState<ShopeeConfigData | null>(null);
  const [products, setProducts] = useState<ShopeeProductItem[]>([]);
  const [orders, setOrders] = useState<ShopeeOrderItem[]>([]);
  const [events, setEvents] = useState<ShopeeEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [form, setForm] = useState({
    partnerId: "",
    partnerKey: "",
    redirectUrl: "",
    shopId: "",
  });
  const [showKey, setShowKey] = useState(false);

  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfg, prods, ords] = await Promise.all([
        apiFetch<ShopeeConfigData>("/api/shopee/config"),
        apiFetch<ShopeeProductItem[]>("/api/shopee/products"),
        apiFetch<ShopeeOrderItem[]>("/api/shopee/orders"),
      ]);
      setConfig(cfg);
      setProducts(prods);
      setOrders(ords);
      if (cfg.configured) {
        setForm({
          partnerId: cfg.partnerId ?? "",
          partnerKey: "",
          redirectUrl: cfg.redirectUrl ?? "",
          shopId: cfg.shopId ?? "",
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
      const data = await apiFetch<ShopeeEventItem[]>("/api/shopee/events");
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
      await apiFetch("/api/shopee/config", { method: "POST", body: JSON.stringify(form) });
      setSaveStatus("ok");
      await loadAll();
    } catch { setSaveStatus("error"); } finally { setSaving(false); }
  };

  const handleGetOAuthUrl = async () => {
    setOauthLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/shopee/oauth-url");
      setOauthUrl(data.url);
    } catch { setOauthUrl(null); } finally { setOauthLoading(false); }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try { await apiFetch("/api/shopee/sync-products", { method: "POST" }); await loadAll(); }
    catch { } finally { setSyncingProducts(false); }
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try { await apiFetch("/api/shopee/sync-orders", { method: "POST" }); await loadAll(); }
    catch { } finally { setSyncingOrders(false); }
  };

  const statusColor = (s: string | null | undefined) => {
    if (!s) return "bg-zinc-700/40 text-zinc-500 border-zinc-600/30";
    const up = s.toUpperCase();
    if (up === "NORMAL" || up === "READY_TO_SHIP" || up === "COMPLETED") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (up === "CANCELLED" || up === "UNPAID") return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Shopee</h1>
          {config?.isActive
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
            : <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">Não configurado</Badge>}
        </div>
        <p className="text-sm text-zinc-500 ml-8">Configure a integração com a Shopee Open Platform API.</p>
      </motion.div>

      {/* ─── CREDENCIAIS ───────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary/70" />
            Credenciais do Parceiro
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
                  <label className="text-xs font-medium text-zinc-400">Partner ID</label>
                  <input className={inputClass} placeholder="ex: 2008485" value={form.partnerId}
                    onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">Shopee Open Platform → Meu App → Partner ID</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Partner Key</label>
                  <div className="relative">
                    <input className={inputClass + " pr-10"} type={showKey ? "text" : "password"}
                      placeholder={config?.configured ? "Nova key para substituir" : "xxxxxxxx..."}
                      value={form.partnerKey}
                      onChange={(e) => setForm((f) => ({ ...f, partnerKey: e.target.value }))} />
                    <button type="button" onClick={() => setShowKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {config?.configured && <p className="text-[10px] text-zinc-600">Key atual: {config.partnerKey} — deixe em branco para manter.</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">URL de Redirecionamento OAuth</label>
                  <input className={inputClass} placeholder="https://seudominio.com/api/shopee/webhook"
                    value={form.redirectUrl}
                    onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">Cadastre esta mesma URL no painel Shopee Open Platform.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Shop ID (após autorização)</label>
                  <input className={inputClass} placeholder="ex: 123456789" value={form.shopId}
                    onChange={(e) => setForm((f) => ({ ...f, shopId: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">Preenchido automaticamente após OAuth ou insira manualmente.</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveStatus === "ok" && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Salvo com sucesso.</span>}
                  {saveStatus === "error" && <span className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" />Erro ao salvar.</span>}
                </div>
                <Button size="sm" onClick={() => void handleSave()}
                  disabled={saving || !form.partnerId || (!form.partnerKey && !config?.configured) || !form.redirectUrl}
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
            Autorização da Loja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-1.5">Como autorizar a loja Shopee</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Salve as credenciais do parceiro acima.</li>
              <li>Clique em "Gerar Link de Autorização" abaixo.</li>
              <li>Abra o link e autorize o acesso à loja.</li>
              <li>Após autorizar, anote o Shop ID e insira no campo acima.</li>
            </ol>
          </div>
          {oauthUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">
                {oauthUrl}
              </code>
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
              Produtos
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
              Nenhum produto sincronizado. Configure as credenciais e clique em "Sincronizar Produtos".
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name || "—"}</p>
                    <p className="text-[10px] text-zinc-600 font-mono">{p.itemId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">R$ {p.price}</span>
                    <span className="text-[10px] text-zinc-600">{p.stock} un.</span>
                    <Badge className={`text-[10px] ${statusColor(p.status)}`}>{p.status ?? "—"}</Badge>
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
                    <p className="text-sm font-medium text-white font-mono">{o.orderSn}</p>
                    <p className="text-[10px] text-zinc-500">{o.buyerUsername}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">R$ {o.totalPrice}</span>
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
              Eventos Webhook
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
              Nenhum evento recebido ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">{ev.eventType ?? "—"}</Badge>
                  <span className="text-xs text-zinc-400 font-mono">Shop: {ev.shopId ?? "—"}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">{formatDate(ev.receivedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IntegrationFutureAutomations
        items={[
          "Resposta automática a avaliações",
          "Alerta de estoque baixo",
          "Relatório de vendas com IA",
          "Atualização automática de preços",
          "Gestão de promoções",
          "Análise de concorrência",
        ]}
      />
    </div>
  );
}
