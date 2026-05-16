import { useState, useEffect, useCallback } from "react";
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
  LogOut,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  Zap,
  Info,
  X,
  Tag,
  DollarSign,
  CalendarDays,
  Boxes,
  Layers,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationFutureAutomations } from "@/components/integrations/IntegrationFutureAutomations";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MLConfigData {
  configured: boolean;
  appId?: string;
  clientSecret?: string;
  accessToken?: string;
  userId?: string;
  nickname?: string;
  siteId?: string;
  redirectUri?: string;
  isActive?: boolean;
  tokenExpired?: boolean;
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
  dateCreated?: string | null;
  syncedAt?: string | null;
}

interface MLEventItem {
  id: number;
  topic?: string | null;
  resource?: string | null;
  userId?: string | null;
  receivedAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
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

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminMercadoLivre() {
  const [config, setConfig]               = useState<MLConfigData | null>(null);
  const [products, setProducts]           = useState<MLProductItem[]>([]);
  const [orders, setOrders]               = useState<MLOrderItem[]>([]);
  const [events, setEvents]               = useState<MLEventItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saveStatus, setSaveStatus]       = useState<"idle" | "ok" | "error">("idle");
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders]     = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [oauthUrl, setOauthUrl]           = useState<string | null>(null);
  const [oauthLoading, setOauthLoading]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [autoRefreshing, setAutoRefreshing]       = useState(false);
  const [tokenExpiredBanner, setTokenExpiredBanner] = useState(false);
  const [noRefreshToken, setNoRefreshToken]         = useState(false);
  const [syncResult, setSyncResult]       = useState<{ products?: number; orders?: number }>({});
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [banner, setBanner]               = useState<"connected" | "error" | null>(null);
  const [connecting, setConnecting]       = useState(false);
  const [selectedProduct, setSelectedProduct]   = useState<MLProductItem | null>(null);
  const [creatingTestItem, setCreatingTestItem] = useState(false);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<MLProductItem | null>(null);
  const [deletingProduct, setDeletingProduct]           = useState(false);
  const [testItemResult, setTestItemResult]     = useState<{
    ok: boolean; id?: string; permalink?: string; status?: string; error?: string;
  } | null>(null);

  const { toast } = useToast();

  const [form, setForm] = useState({
    appId: "", clientSecret: "", redirectUri: "", siteId: "MLB",
  });
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = (text: string) => void navigator.clipboard.writeText(text);

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const fmtTokenExpiry = (d: string | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    const diff = dt.getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}min restantes`;
    return `${m}min restantes`;
  };

  // ─── Check URL params after OAuth redirect ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ml_connected") === "1") {
      setBanner("connected");
      window.history.replaceState({}, "", window.location.pathname);
      toast({
        title: "Mercado Livre conectado",
        description: "Conta autenticada com sucesso. Sincronize seus dados.",
      });
    } else if (params.get("ml_error")) {
      const errMsg = decodeURIComponent(params.get("ml_error") ?? "Erro desconhecido");
      setBanner("error");
      setErrorMsg(errMsg);
      window.history.replaceState({}, "", window.location.pathname);
      toast({
        title: "Falha na autorização",
        description: errMsg,
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, prods, ords] = await Promise.all([
        apiFetch<MLConfigData>("/api/ml/config"),
        apiFetch<MLProductItem[]>("/api/ml/products"),
        apiFetch<MLOrderItem[]>("/api/ml/orders"),
      ]);

      // ── Auto-refresh silencioso se token expirado ──────────────────
      if (cfg.tokenExpired && cfg.isActive) {
        setAutoRefreshing(true);
        try {
          await apiFetch("/api/ml/refresh-token", { method: "POST" });
          // Refresh ok — reload config to clear expired flag
          const refreshedCfg = await apiFetch<MLConfigData>("/api/ml/config");
          setConfig(refreshedCfg);
          setTokenExpiredBanner(false);
        } catch (e) {
          // Refresh failed — exibe mensagem orientando a reconectar
          const msg = e instanceof Error ? e.message : "";
          const isNoToken = msg.toLowerCase().includes("refresh token") || msg.toLowerCase().includes("não disponível");
          setConfig(cfg);
          setTokenExpiredBanner(true);
          if (isNoToken) setNoRefreshToken(true);
        } finally {
          setAutoRefreshing(false);
        }
      } else {
        setConfig(cfg);
        if (!cfg.tokenExpired) setTokenExpiredBanner(false);
      }

      setProducts(prods);
      setOrders(ords);
      if (cfg.configured) {
        setForm((f) => ({
          ...f,
          appId:       cfg.appId       ?? "",
          redirectUri: cfg.redirectUri ?? "",
          siteId:      cfg.siteId      ?? "MLB",
        }));
      }
    } catch {
      setConfig({ configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      setEvents(await apiFetch<MLEventItem[]>("/api/ml/events"));
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => { void loadAll(); void loadEvents(); }, [loadAll]);

  // ─── Save credentials ─────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveStatus("idle");
    try {
      await apiFetch("/api/ml/config", { method: "POST", body: JSON.stringify(form) });
      setSaveStatus("ok");
      await loadAll();
    } catch { setSaveStatus("error"); }
    finally { setSaving(false); }
  };

  // ─── Generate OAuth URL (display only) ────────────────────────────────────
  const handleGetOAuthUrl = async () => {
    setOauthLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/ml/oauth-url");
      setOauthUrl(data.url);
    } catch (e) {
      toast({
        title: "Erro ao gerar link",
        description: e instanceof Error ? e.message : "Verifique se as credenciais foram salvas.",
        variant: "destructive",
      });
      setOauthUrl(null);
    } finally { setOauthLoading(false); }
  };

  // ─── Connect — fetches URL then navigates ────────────────────────────────
  const handleConnect = async () => {
    // Guard: credentials must be saved first
    if (!config?.configured) {
      toast({
        title: "Credenciais não salvas",
        description: "Preencha e salve App ID, Client Secret e URI de callback antes de conectar.",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/ml/oauth-url");
      if (!data.url) throw new Error("URL de autorização não retornada pelo servidor.");

      // Primary: same-window navigation so the OAuth callback brings the user
      // back to this page with ?ml_connected=1 detected on mount.
      // Fallback: if running inside an iframe (e.g. Replit preview pane),
      // window.location.href is blocked — open in a new tab instead.
      const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
      if (inFrame) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setConnecting(false); // page won't unload, reset state
      } else {
        window.location.href = data.url;
        // Do NOT reset connecting — page navigates away on success
      }
    } catch (e) {
      toast({
        title: "Erro ao gerar link de conexão",
        description: e instanceof Error ? e.message : "Tente novamente ou salve as credenciais.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  // ─── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await apiFetch("/api/ml/disconnect", { method: "POST" });
      setOauthUrl(null);
      toast({ title: "Conta desconectada", description: "Tokens do Mercado Livre removidos com sucesso." });
      await loadAll();
    } catch (e) {
      toast({
        title: "Erro ao desconectar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setDisconnecting(false); }
  };

  // ─── Refresh token ────────────────────────────────────────────────────────
  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    try {
      await apiFetch("/api/ml/refresh-token", { method: "POST" });
      toast({ title: "Token renovado", description: "Acesso ao Mercado Livre reativado com sucesso." });
      setNoRefreshToken(false);
      setTokenExpiredBanner(false);
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const isNoToken = msg.toLowerCase().includes("refresh token") || msg.toLowerCase().includes("não disponível");
      if (isNoToken) {
        // Sem refresh token — orientar reconexão sem erro técnico
        setNoRefreshToken(true);
        setTokenExpiredBanner(true);
      } else {
        toast({
          title: "Falha ao renovar token",
          description: "Reconecte sua conta Mercado Livre.",
          variant: "destructive",
        });
        setTokenExpiredBanner(true);
      }
    } finally { setRefreshingToken(false); }
  };

  // ─── Sync products ────────────────────────────────────────────────────────
  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const r = await apiFetch<{ ok: boolean; synced: number }>("/api/ml/sync-products", { method: "POST" });
      setSyncResult((prev) => ({ ...prev, products: r.synced }));
      toast({
        title: "Anúncios sincronizados",
        description: `${r.synced} anúncio${r.synced !== 1 ? "s" : ""} importado${r.synced !== 1 ? "s" : ""} com sucesso.`,
      });
      await loadAll();
    } catch (e) {
      toast({
        title: "Falha ao sincronizar anúncios",
        description: e instanceof Error ? e.message : "Verifique a conexão e tente novamente.",
        variant: "destructive",
      });
    } finally { setSyncingProducts(false); }
  };

  // ─── Create test item ─────────────────────────────────────────────────────
  const handleCreateTestItem = async () => {
    setCreatingTestItem(true);
    setTestItemResult(null);
    try {
      const r = await apiFetch<{ ok: boolean; item: { id?: string; permalink?: string; status?: string } }>(
        "/api/ml/create-test-item", { method: "POST" },
      );
      setTestItemResult({ ok: true, id: r.item.id, permalink: r.item.permalink, status: r.item.status });
      toast({
        title: "Anúncio criado",
        description: `ID: ${r.item.id ?? "—"} — Status: ${r.item.status ?? "—"}`,
      });
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido.";
      setTestItemResult({ ok: false, error: msg });
      toast({ title: "Falha ao criar anúncio teste", description: msg, variant: "destructive" });
    } finally { setCreatingTestItem(false); }
  };

  // ─── Delete product ───────────────────────────────────────────────────────
  const handleDeleteProduct = async (product: MLProductItem) => {
    setDeletingProduct(true);
    try {
      await apiFetch(`/api/ml/products/${product.id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setConfirmDeleteProduct(null);
      toast({ title: "Anúncio excluído", description: `"${product.title ?? product.mlItemId}" removido da listagem.` });
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setDeletingProduct(false); }
  };

  // ─── Sync orders ──────────────────────────────────────────────────────────
  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const r = await apiFetch<{ ok: boolean; synced: number }>("/api/ml/sync-orders", { method: "POST" });
      setSyncResult((prev) => ({ ...prev, orders: r.synced }));
      toast({
        title: "Pedidos sincronizados",
        description: `${r.synced} pedido${r.synced !== 1 ? "s" : ""} importado${r.synced !== 1 ? "s" : ""} com sucesso.`,
      });
      await loadAll();
    } catch (e) {
      toast({
        title: "Falha ao sincronizar pedidos",
        description: e instanceof Error ? e.message : "Verifique a conexão e tente novamente.",
        variant: "destructive",
      });
    } finally { setSyncingOrders(false); }
  };

  const statusColor = (s: string | null | undefined) => {
    if (!s) return "bg-zinc-700/40 text-zinc-500 border-zinc-600/30";
    const u = s.toLowerCase();
    if (["active", "paid", "delivered"].includes(u)) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (["cancelled", "closed"].includes(u))         return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  };

  const isConnected  = config?.isActive && !config.tokenExpired;
  const tokenExpired = config?.isActive && config.tokenExpired;
  const timeLeft     = fmtTokenExpiry(config?.tokenExpiry);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Mercado Livre</h1>
          {isConnected
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Conectado</Badge>
            : tokenExpired
              ? <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Token expirado</Badge>
              : <Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-600/30 text-[10px]">Não conectado</Badge>
          }
        </div>
        <p className="text-sm text-zinc-500 ml-8">Integração OAuth2 com a API oficial do Mercado Livre.</p>
      </motion.div>

      {/* ─── BANNER após OAuth redirect ─────────────────────────────── */}
      {banner === "connected" && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">Conta conectada com sucesso. Clique em "Sincronizar" para importar seus dados.</p>
          <button onClick={() => setBanner(null)} className="ml-auto text-zinc-500 hover:text-white text-xs">Fechar</button>
        </div>
      )}
      {banner === "error" && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">Erro na autorização: <span className="font-mono">{errorMsg}</span></p>
          <button onClick={() => setBanner(null)} className="ml-auto text-zinc-500 hover:text-white text-xs">Fechar</button>
        </div>
      )}

      {/* ─── CONTA CONECTADA — status card ─────────────────────────── */}
      {config?.isActive && (
        <Card className="bg-white/3 border-white/8">
          <CardContent className="pt-4 pb-4">
            {/* ── header row: avatar + info + actions ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {/* avatar + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">
                      {config.nickname || "Conta Mercado Livre"}
                    </p>
                    {isConnected
                      ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <ShieldX    className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    }
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-[10px] text-zinc-500 font-mono">ID: {config.userId}</span>
                    {timeLeft && !tokenExpired && (
                      <span className="text-[10px] font-medium text-zinc-400">Token: {timeLeft}</span>
                    )}
                    {autoRefreshing && (
                      <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />Renovando...
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600">Site: {config.siteId}</span>
                  </div>
                </div>
              </div>

              {/* action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {tokenExpired && !autoRefreshing && (
                  noRefreshToken ? (
                    <Button size="sm" variant="ghost"
                      onClick={() => void handleConnect()}
                      disabled={connecting}
                      className="h-7 px-2.5 text-amber-400 hover:text-amber-300 border border-amber-500/20 gap-1.5 text-xs whitespace-nowrap">
                      {connecting
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RotateCcw className="w-3 h-3" />}
                      Reconectar conta
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost"
                      onClick={() => void handleRefreshToken()}
                      disabled={refreshingToken}
                      className="h-7 px-2.5 text-amber-400 hover:text-amber-300 border border-amber-500/20 gap-1.5 text-xs whitespace-nowrap">
                      {refreshingToken
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RotateCcw className="w-3 h-3" />}
                      Renovar token
                    </Button>
                  )
                )}
                <Button size="sm" variant="ghost"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="h-7 px-2.5 text-red-400 hover:text-red-300 border border-red-500/20 gap-1.5 text-xs whitespace-nowrap">
                  {disconnecting
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <LogOut className="w-3 h-3" />}
                  Desconectar
                </Button>
              </div>
            </div>

            {/* ── Token expirado — banner de orientação ──────────── */}
            {tokenExpiredBanner && !autoRefreshing && (
              <div className="mt-3 flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed flex-1">
                  {noRefreshToken
                    ? <>Sua conexão expirou. <button
                        onClick={() => void handleConnect()}
                        disabled={connecting}
                        className="font-semibold underline underline-offset-2 hover:text-amber-200 transition-colors disabled:opacity-50">
                        Reconecte sua conta Mercado Livre
                      </button> para continuar.</>
                    : <>Sua conexão com o Mercado Livre expirou. Clique em{" "}
                        <button
                          onClick={() => void handleRefreshToken()}
                          disabled={refreshingToken}
                          className="font-semibold underline underline-offset-2 hover:text-amber-200 transition-colors disabled:opacity-50">
                          Renovar token
                        </button>{" "}
                        para reconectar.</>
                  }
                </p>
              </div>
            )}

            {/* stats row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
              {[
                { label: "Anúncios",    value: products.length, icon: Package },
                { label: "Pedidos",     value: orders.length,   icon: ClipboardList },
                { label: "Notificações", value: events.length,  icon: MessageSquare },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/3 border border-white/6 rounded-lg px-2 py-2 sm:px-3 sm:py-2.5 text-center">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/60 mx-auto mb-1" />
                  <p className="text-base sm:text-lg font-bold text-white">{value}</p>
                  <p className="text-[9px] sm:text-[10px] text-zinc-500 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── CREDENCIAIS ────────────────────────────────────────────── */}
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
                  {config?.configured && (
                    <p className="text-[10px] text-zinc-600">Secret atual: {config.clientSecret} — deixe em branco para manter.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">URI de Redirecionamento</label>
                  <input className={inputClass} placeholder="https://seudominio.replit.app/api/ml/oauth-callback"
                    value={form.redirectUri} onChange={(e) => setForm((f) => ({ ...f, redirectUri: e.target.value }))} />
                  <p className="text-[10px] text-zinc-600">Deve ser idêntica à URI cadastrada no painel do ML.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Site</label>
                  <select className={inputClass + " cursor-pointer"} value={form.siteId}
                    onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
                    {SITE_IDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  {saveStatus === "ok"    && <span className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Salvo.</span>}
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

      {/* ─── OAUTH ──────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary/70" />
            Autorização OAuth2
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ─── instrução setup ──────────────────────────────────── */}
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-1.5">Como autenticar a conta Mercado Livre</p>
            <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Crie um app em <span className="text-primary/80">developers.mercadolivre.com.br</span> e obtenha o App ID e Client Secret.</li>
              <li>Cadastre a URI de callback: <code className="text-primary/80 font-mono">https://SEU_DOMINIO/api/ml/oauth-callback</code></li>
              <li>Salve as credenciais acima e clique em "Conectar".</li>
              <li>Faça login com sua conta ML e autorize o app.</li>
              <li>Você será redirecionado de volta com a conta já conectada.</li>
            </ol>
          </div>

          {/* ─── botão principal de conexão ───────────────────────── */}
          {!config?.isActive && (
            <Button
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="w-full bg-primary text-black hover:bg-primary/90 gap-2 h-10 font-semibold"
            >
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecionando para Mercado Livre...</>
                : <><Zap className="w-4 h-4" />Conectar com Mercado Livre</>
              }
            </Button>
          )}

          {/* ─── link gerado (avançado) ───────────────────────────── */}
          {oauthUrl && (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">{oauthUrl}</code>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-zinc-500 hover:text-white"
                onClick={() => copyToClipboard(oauthUrl)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <a href={oauthUrl} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          )}

          {/* ─── gerar link manual (avançado) ────────────────────── */}
          <Button size="sm" variant="ghost" onClick={() => void handleGetOAuthUrl()}
            disabled={oauthLoading || !config?.configured}
            className="border border-white/8 text-zinc-500 hover:text-zinc-300 gap-1.5 text-xs">
            {oauthLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
            {oauthUrl ? "Regenerar link manualmente" : "Gerar link manualmente"}
          </Button>
        </CardContent>
      </Card>

      {/* ─── ANÚNCIOS ───────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-primary/70 shrink-0" />
              Anúncios
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{products.length}</Badge>
              {syncResult.products !== undefined && (
                <span className="text-[10px] text-emerald-400">{syncResult.products} sincronizados</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span title={config?.tokenExpired ? "Reconecte sua conta para continuar" : undefined}>
                <Button size="sm" variant="ghost"
                  onClick={() => void handleCreateTestItem()}
                  disabled={creatingTestItem || !config?.isActive || config?.tokenExpired}
                  className="h-7 px-2.5 gap-1.5 text-xs border border-white/6 whitespace-nowrap
                    text-zinc-500 hover:text-amber-400
                    disabled:opacity-40 disabled:pointer-events-none">
                  {creatingTestItem
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Criando...</>
                    : <><Zap className="w-3 h-3" />Criar anúncio</>
                  }
                </Button>
              </span>
              <span title={config?.tokenExpired ? "Reconecte sua conta para continuar" : undefined}>
                <Button size="sm" variant="ghost"
                  onClick={() => void handleSyncProducts()}
                  disabled={syncingProducts || !config?.isActive || config?.tokenExpired}
                  className="h-7 px-2.5 gap-1.5 text-xs whitespace-nowrap
                    text-zinc-500 hover:text-white
                    disabled:opacity-40 disabled:pointer-events-none">
                  <RefreshCw className={`w-3 h-3 ${syncingProducts ? "animate-spin" : ""}`} />
                  {syncingProducts ? "Sincronizando..." : "Sincronizar"}
                </Button>
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ─── resultado do anúncio teste ─────────────────────────── */}
          {testItemResult && (
            <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
              testItemResult.ok
                ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/8 border-red-500/20 text-red-300"
            }`}>
              {testItemResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                : <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              }
              {testItemResult.ok ? (
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium">Anúncio criado com sucesso</p>
                  <p className="text-emerald-400/70 font-mono text-[10px]">ID: {testItemResult.id ?? "—"}</p>
                  <p className="text-emerald-400/70 text-[10px]">Status: {testItemResult.status ?? "—"}</p>
                  {testItemResult.permalink && (
                    <a href={testItemResult.permalink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                      Ver no Mercado Livre <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="font-medium">Falha ao criar anúncio</p>
                  <p className="text-red-400/70 text-[10px] break-words">{testItemResult.error}</p>
                </div>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {config?.isActive
                ? "Nenhum anúncio sincronizado. Clique em Sincronizar."
                : "Conecte a conta para importar seus anúncios."}
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="group flex items-center gap-3 bg-white/3 hover:bg-white/6 border border-white/5 hover:border-primary/25 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-primary/90 transition-colors">
                      {p.title || "—"}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">{p.mlItemId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400 hidden sm:inline">R$ {p.price}</span>
                    <span className="text-[10px] text-zinc-600 hidden sm:inline">{p.availableQuantity} un.</span>
                    <Badge className={`text-[10px] ${statusColor(p.status)}`}>{p.status ?? "—"}</Badge>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-zinc-300 transition-colors" />
                      </a>
                    )}
                    <Info className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary/60 transition-colors shrink-0" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteProduct(p); }}
                      className="p-1 rounded text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                      title="Excluir anúncio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PEDIDOS ────────────────────────────────────────────────── */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary/70" />
              Pedidos
              <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">{orders.length}</Badge>
              {syncResult.orders !== undefined && (
                <span className="text-[10px] text-emerald-400">{syncResult.orders} sincronizados</span>
              )}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => void handleSyncOrders()}
              disabled={syncingOrders || !config?.isActive || config.tokenExpired}
              className="h-7 px-2.5 text-zinc-500 hover:text-white gap-1.5 text-xs">
              <RefreshCw className={`w-3 h-3 ${syncingOrders ? "animate-spin" : ""}`} />
              {syncingOrders ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-sm">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {config?.isActive
                ? "Nenhum pedido sincronizado. Clique em Sincronizar."
                : "Conecte a conta para importar seus pedidos."}
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white font-mono">{o.mlOrderId}</p>
                    <p className="text-[10px] text-zinc-500">{o.buyerNickname || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400">R$ {o.totalAmount}</span>
                    <Badge className={`text-[10px] ${statusColor(o.status)}`}>{o.status ?? "—"}</Badge>
                    <span className="text-[10px] text-zinc-600">{fmt(o.dateCreated)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── NOTIFICAÇÕES ───────────────────────────────────────────── */}
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
                  <span className="text-[10px] text-zinc-600 shrink-0">{fmt(ev.receivedAt)}</span>
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
          "Geração de descrição de anúncio com IA",
        ]}
      />

      {/* ─── MODAL DETALHES DO ANÚNCIO ─────────────────────────────────── */}
      {selectedProduct && (() => {
        const p = selectedProduct;

        const fmtDate = (d: string | null | undefined) =>
          d
            ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "Não informado";
        const val = (v: string | number | null | undefined) =>
          v !== null && v !== undefined && String(v).trim() !== "" ? String(v) : "Não informado";

        // Infer origin from how the item was created:
        // items created via "Criar anúncio" have a valid ML item ID starting with "MLB"
        // vs items synced from API vs items with IDs that look like ML IDs
        const origem = p.mlItemId?.startsWith("MLB")
          ? "Sincronizado / Criado pelo IAttom"
          : "Importado";

        const fields: Array<{ icon: React.ElementType; label: string; value: string; span?: number; link?: string; badge?: string | null }> = [
          { icon: Tag,          label: "ID Mercado Livre",      value: val(p.mlItemId),         span: 2 },
          { icon: DollarSign,   label: "Preço",                 value: p.price && p.price !== "0" ? `R$ ${p.price}` : "Não informado" },
          { icon: Boxes,        label: "Estoque",               value: p.availableQuantity !== null && p.availableQuantity !== undefined ? `${p.availableQuantity} unidades` : "Não informado" },
          { icon: Layers,       label: "Status",                value: "", badge: p.status },
          { icon: Package,      label: "Origem",                value: origem },
          { icon: Link2,        label: "Link do anúncio",       value: p.permalink ? "Ver no Mercado Livre" : "Não informado", link: p.permalink ?? undefined, span: 2 },
          { icon: CalendarDays, label: "Sincronizado em",       value: fmtDate(p.syncedAt),     span: 2 },
        ];

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
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug">{val(p.title)}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.mlItemId}</p>
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
                <div className="grid grid-cols-2 gap-2.5">
                  {fields.map(({ icon: Icon, label, value, span, link, badge }) => (
                    <div
                      key={label}
                      className={`bg-white/3 border border-white/6 rounded-lg px-3 py-2.5 ${span === 2 ? "col-span-2" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3 h-3 text-primary/50 shrink-0" />
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</p>
                      </div>
                      {badge !== undefined ? (
                        <Badge className={`text-[10px] ${statusColor(badge)}`}>
                          {badge ?? "Não informado"}
                        </Badge>
                      ) : link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {value}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <p className={`text-xs font-medium leading-snug ${value === "Não informado" ? "text-zinc-600" : "text-white"}`}>
                          {value}
                        </p>
                      )}
                    </div>
                  ))}
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

      {/* ─── CONFIRM DELETE DIALOG ──────────────────────────────────── */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">Excluir anúncio</h3>
            <p className="text-sm text-zinc-400 mb-1">Deseja excluir este anúncio?</p>
            <p className="text-sm font-medium text-zinc-300 truncate mb-5">
              {confirmDeleteProduct.title ?? confirmDeleteProduct.mlItemId}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteProduct(null)}
                disabled={deletingProduct}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDeleteProduct(confirmDeleteProduct)}
                disabled={deletingProduct}
                className="px-4 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deletingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
