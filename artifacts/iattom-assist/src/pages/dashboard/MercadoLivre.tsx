import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, X, Info, AlertCircle,
  Megaphone, ClipboardList, Link2,
  CheckCircle2, BarChart2, Package, TrendingUp,
  Loader2, WifiOff, RefreshCw, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface MLStatus {
  connected: boolean;
  nickname: string | null;
  tokenExpired: boolean;
  appConfigured: boolean;
}

type ConnectionState = "loading" | "disconnected" | "connected" | "expired" | "not_configured";

// ─── InformativeModal ─────────────────────────────────────────────────────────

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
            <Button
              onClick={() => { action.onClick(); onClose(); }}
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              {action.label}
            </Button>
          )}
          <Button
            onClick={onClose}
            variant={action ? "outline" : "default"}
            className={action
              ? "border-white/10 text-muted-foreground hover:text-white"
              : "w-full bg-primary text-black hover:bg-primary/90 font-semibold"}
          >
            {action ? "Cancelar" : "Entendido"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MercadoLivre() {
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const [connState, setConnState] = useState<ConnectionState>("loading");
  const [nickname, setNickname] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // Project context passed from ProjectDetail when user clicks Continuar
  const [adProjectCtx, setAdProjectCtx] = useState<{
    projectTitle: string;
    suggestedPrice: string;
  } | null>(null);
  const [adSuggestedPrice, setAdSuggestedPrice] = useState("");

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  // ─── Status fetch ──────────────────────────────────────────────────────────

  const fetchStatus = async () => {
    setConnState("loading");
    try {
      const res = await fetch(`${BASE}/api/me/ml/status`, { credentials: "include" });
      if (!res.ok) { setConnState("disconnected"); return; }
      const data = (await res.json()) as MLStatus;
      if (!data.appConfigured)        { setConnState("not_configured"); }
      else if (data.connected && data.tokenExpired) { setConnState("expired"); setNickname(data.nickname); }
      else if (data.connected)        { setConnState("connected"); setNickname(data.nickname); }
      else                            { setConnState("disconnected"); }
    } catch {
      setConnState("disconnected");
    }
  };

  // ─── On mount: read URL params + fetch status ──────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mlConnected = params.get("ml_connected");
    const mlError = params.get("ml_error");
    if (mlConnected || mlError) window.history.replaceState({}, "", window.location.pathname);
    if (mlError) showInfo("Erro na conexão", `Não foi possível conectar ao Mercado Livre. Código: ${mlError}. Tente novamente.`);
    // Read ad_project_context from sessionStorage (set by ProjectDetail.handleContinue)
    const rawAdCtx = sessionStorage.getItem("ad_project_context");
    if (rawAdCtx) {
      try {
        const ctx = JSON.parse(rawAdCtx) as { projectTitle?: string; suggestedPrice?: string; platform?: string };
        if (ctx.platform === "mercado_livre") {
          setAdProjectCtx({ projectTitle: ctx.projectTitle ?? "", suggestedPrice: ctx.suggestedPrice ?? "" });
          setAdSuggestedPrice(ctx.suggestedPrice ?? "");
        }
        sessionStorage.removeItem("ad_project_context");
      } catch { /* noop */ }
    }
    void fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── OAuth connect ─────────────────────────────────────────────────────────

  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch(`${BASE}/api/me/ml/oauth-url`, { credentials: "include" });
      if (!res.ok) { showInfo("Erro ao conectar", "Não foi possível iniciar a conexão com Mercado Livre. Verifique se o app está configurado no painel administrativo."); return; }
      const data = (await res.json()) as { url?: string };
      if (!data.url) { showInfo("Erro ao conectar", "Não foi possível iniciar a conexão com Mercado Livre. Tente novamente."); return; }
      window.location.href = data.url;
    } catch {
      showInfo("Erro ao conectar", "Não foi possível iniciar a conexão com Mercado Livre. Verifique sua conexão e tente novamente.");
    } finally {
      setConnectLoading(false);
    }
  };

  // ─── Disconnect ────────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${BASE}/api/me/ml/disconnect`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Falha ao desconectar.");
      setConnState("disconnected");
      setNickname(null);
    } catch {
      showInfo("Erro ao desconectar", "Não foi possível desconectar a conta. Tente novamente.");
    } finally {
      setDisconnecting(false);
    }
  };

  // ─── Criar Anúncio ─────────────────────────────────────────────────────────

  const handleCriarAnuncio = () => {
    sessionStorage.setItem("ad_platform_context", JSON.stringify({ platform: "mercado_livre" }));
    window.location.href = `${BASE}/dashboard/projects`;
  };

  const handleAnalytics = () => {
    showInfo("Análise Mercado Livre", "As métricas de performance estarão disponíveis após a conexão da conta.");
  };

  const handleCriarCampanha = () => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ goal: "Vender no Mercado Livre" }));
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = () => {
    sessionStorage.setItem("content_platform_context", JSON.stringify({ platform: "mercadolivre" }));
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  // ─── Derived UI ────────────────────────────────────────────────────────────

  const isConnected = connState === "connected";
  const isExpired   = connState === "expired";
  const isLoading   = connState === "loading";

  const connectButtonLabel =
    isExpired   ? "Reconectar conta" :
    isConnected ? "Conta conectada"  :
                  "Conectar Mercado Livre";

  const connectButtonIcon =
    connectLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> :
    isConnected     ? <CheckCircle2 className="w-3.5 h-3.5 mr-2" />        :
                      <Link2 className="w-3.5 h-3.5 mr-2" />;

  // ─── Status card ───────────────────────────────────────────────────────────

  type BtnVariant = "connect" | "reconnect" | "disconnect";
  const statusCard = (() => {
    if (isLoading) return {
      icon: <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />,
      title: "Verificando conexão...", sub: "Aguarde um momento.",
      btn: null as null | { label: string; icon: React.ReactNode; variant: BtnVariant },
    };
    if (connState === "not_configured") return {
      icon: <AlertCircle className="w-4 h-4 text-yellow-500/70 shrink-0" />,
      title: "App Mercado Livre não configurado",
      sub: "Configure as credenciais no painel administrativo para ativar a conexão.",
      btn: null,
    };
    if (isConnected) return {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
      title: nickname ? `Conta conectada: ${nickname}` : "Conta Mercado Livre conectada",
      sub: "Sua conta está ativa. Você pode criar e publicar anúncios.",
      btn: { label: "Desconectar", icon: <LogOut className="w-3 h-3 mr-1.5" />, variant: "disconnect" as BtnVariant },
    };
    if (isExpired) return {
      icon: <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />,
      title: "Token expirado",
      sub: "Sua sessão expirou. Reconecte para continuar usando a integração.",
      btn: { label: "Reconectar", icon: <RefreshCw className="w-3 h-3 mr-1.5" />, variant: "reconnect" as BtnVariant },
    };
    return {
      icon: <WifiOff className="w-4 h-4 text-muted-foreground shrink-0" />,
      title: "Conta Mercado Livre não conectada",
      sub: "Conecte sua conta para acessar produtos, campanhas e vendas.",
      btn: { label: "Conectar", icon: <Link2 className="w-3 h-3 mr-1.5" />, variant: "connect" as BtnVariant },
    };
  })();

  const activityRows = [
    { icon: CheckCircle2, label: "Conexão", value: isLoading ? "…" : isConnected ? "Ativa" : isExpired ? "Expirada" : "Aguardando", ok: isConnected },
    { icon: Package,      label: "Produtos conectados", value: "—", ok: false },
    { icon: BarChart2,    label: "Eventos recebidos",   value: "—", ok: false },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

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

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mercado Livre</h1>
              <p className="text-xs text-muted-foreground">Gerencie produtos, campanhas e suas vendas no Mercado Livre</p>
            </div>
          </div>
          <Button
            onClick={isConnected ? undefined : handleConnect}
            disabled={connectLoading || isConnected || isLoading}
            className={
              isConnected
                ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default font-semibold"
                : "bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            }
            size="sm"
          >
            {connectButtonIcon}
            {connectButtonLabel}
          </Button>
        </div>

        {/* ── Status Card ──────────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {statusCard.icon}
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{statusCard.title}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{statusCard.sub}</p>
              </div>
              {statusCard.btn && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={
                    statusCard.btn.variant === "disconnect"
                      ? () => void handleDisconnect()
                      : () => void handleConnect()
                  }
                  disabled={statusCard.btn.variant === "disconnect" ? disconnecting : connectLoading}
                  className={
                    statusCard.btn.variant === "disconnect"
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto shrink-0"
                      : statusCard.btn.variant === "reconnect"
                        ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 ml-auto shrink-0"
                        : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10 ml-auto shrink-0"
                  }
                >
                  {(statusCard.btn.variant === "disconnect" ? disconnecting : connectLoading)
                    ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    : statusCard.btn.icon}
                  {(statusCard.btn.variant === "disconnect" ? disconnecting : connectLoading)
                    ? "Aguarde..."
                    : statusCard.btn.label}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Projeto selecionado para anuncio (quando vindo de Projetos Salvos) ─── */}
        {adProjectCtx && isConnected && (
          <Card className="bg-primary/[0.05] border-primary/20 mb-5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Projeto para anuncio</p>
              </div>
              <p className="text-sm font-medium text-white truncate">{adProjectCtx.projectTitle}</p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Preco sugerido (BRL)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adSuggestedPrice}
                  onChange={(e) => setAdSuggestedPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
                />
                {adProjectCtx.suggestedPrice && (
                  <p className="text-[10px] text-zinc-500">Preenchido automaticamente a partir do projeto salvo. Voce pode editar antes de publicar.</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => showInfo(
                  "Publicacao disponivel na proxima etapa",
                  "O fluxo de publicacao assistida para este projeto estara disponivel em breve.",
                )}
                className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 h-8 text-xs"
              >
                <Megaphone className="w-3 h-3 mr-1.5" />
                Criar anuncio com este projeto
              </Button>
            </CardContent>
          </Card>
        )}

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
                Acompanhe suas campanhas do Mercado Livre. Visualizações, alcance e conversões disponíveis após conexão.
              </p>
              <div className="grid grid-cols-3 gap-2 py-1">
                {[
                  { icon: BarChart2, label: "Visualizações", value: "—" },
                  { icon: Package, label: "Alcance", value: "—" },
                  { icon: TrendingUp, label: "Conversões", value: "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2 rounded bg-white/5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-white">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnalytics}
                className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
              >
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCriarCampanha}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
                >
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  Criar campanha
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCriarConteudo}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
                >
                  <ClipboardList className="w-3 h-3 mr-1.5" />
                  Criar conteúdo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCriarAnuncio}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10 h-8 text-xs"
                >
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  Criar anúncio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Atividade da conta */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Atividade da conta</CardTitle>
                  <p className="text-xs text-muted-foreground">Movimentações recentes</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 py-2">
                {activityRows.map(({ icon: Icon, label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${ok ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className={`text-xs font-medium ${ok ? "text-emerald-400" : "text-white"}`}>{value}</span>
                  </div>
                ))}
              </div>
              {!isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connectLoading || isLoading}
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8 text-xs"
                >
                  {connectLoading
                    ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    : <Link2 className="w-3 h-3 mr-1.5" />
                  }
                  Conectar conta
                </Button>
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
                  { icon: Package, label: "Produtos", value: "—" },
                  { icon: TrendingUp, label: "Conversões", value: "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2 rounded bg-white/5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-white">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnalytics}
                className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
              >
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
