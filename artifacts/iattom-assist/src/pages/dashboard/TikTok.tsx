import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Music2, Link2, Loader2, X, Info, AlertCircle,
  Megaphone, Video, ClipboardList, ExternalLink,
  CheckCircle2, BarChart2, Users, TrendingUp,
  RefreshCw, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TikTokStatus {
  connected: boolean;
  platformConfigured: boolean;
  connectionId?: number;
  openId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  connectedAt?: string;
  expiresAt?: string | null;
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

export function TikTok() {
  const { toast } = useToast();

  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [modal, setModal] = useState<{
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${BASE}/api/tiktok/me/status`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TikTokStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false, platformConfigured: false });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStatus();
    setIsRefreshing(false);
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("tiktok_connected");
    const error = params.get("tiktok_error");

    if (connected) {
      toast({ description: "Conta TikTok conectada com sucesso." });
      window.history.replaceState({}, "", window.location.pathname);
      void loadStatus();
    }
    if (error) {
      toast({ variant: "destructive", description: decodeURIComponent(error) });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast, loadStatus]);

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = `${BASE}/api/tiktok/oauth/start`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${BASE}/api/tiktok/me/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao desconectar.");
      setStatus(s =>
        s
          ? { ...s, connected: false, connectionId: undefined, openId: null, displayName: null, avatarUrl: null }
          : null,
      );
      toast({ description: "Conta TikTok desconectada." });
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Falha ao desconectar.",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAnalytics = () => {
    showInfo(
      "Análise TikTok",
      "As métricas de performance dos seus vídeos e campanhas TikTok estarão disponíveis após a conexão da conta.",
    );
  };

  const handleCriarCampanha = () => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ goal: "Vender no TikTok" }));
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = () => {
    sessionStorage.setItem("content_platform_context", JSON.stringify({ platform: "tiktok" }));
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  const handleCriarAnuncio = () => {
    window.open("https://ads.tiktok.com/i18n/", "_blank", "noopener,noreferrer");
  };

  const isConnected = status?.connected ?? false;

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
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TikTok</h1>
              <p className="text-xs text-muted-foreground">Gerencie anúncios, conteúdo e sua presença no TikTok</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || statusLoading}
              className="border-white/10 text-zinc-400 hover:text-white gap-1.5 text-xs">
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting || statusLoading}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold"
              size="sm"
            >
              {connecting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                : <Link2 className="w-3.5 h-3.5 mr-2" />}
              Conectar TikTok
            </Button>
          </div>
        </div>

        {/* ── Status Card ──────────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando conexão...</span>
              </div>
            ) : isConnected ? (
              <div className="flex flex-wrap items-center gap-3">
                {status?.avatarUrl ? (
                  <img
                    src={status.avatarUrl}
                    alt="TikTok avatar"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Music2 className="w-5 h-5 text-violet-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {status?.displayName || "Conta TikTok"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400">Conectado</span>
                    {status?.openId && (
                      <span className="text-xs text-zinc-600">· {status.openId}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="border-white/10 text-muted-foreground hover:text-white h-8 text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reconectar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDisconnect()}
                    disabled={disconnecting}
                    className="text-red-400/70 hover:text-red-400 h-8 text-xs gap-1.5"
                  >
                    {disconnecting
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <LogOut className="w-3 h-3" />}
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Conta TikTok não conectada</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Conecte sua conta para acessar o Shop e publicar conteúdo.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 ml-auto shrink-0"
                >
                  {connecting
                    ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                    : <Link2 className="w-3 h-3 mr-1.5" />}
                  Conectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Feature Cards ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* TikTok Ads */}
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
                Acompanhe suas campanhas no TikTok. Visualizações, alcance e conversões disponíveis após conexão.
              </p>
              <div className="grid grid-cols-3 gap-2 py-1">
                {[
                  { icon: BarChart2, label: "Visualizações", value: "—" },
                  { icon: Users, label: "Alcance", value: "—" },
                  { icon: TrendingUp, label: "Cliques", value: "—" },
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

          {/* Vídeos e Conteúdo */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Conteúdo</CardTitle>
                  <p className="text-xs text-muted-foreground">Conteúdos e publicações</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Monitore sua grade de conteúdo TikTok. Scripts e criativos são criados nos módulos centrais da plataforma.
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
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Criar anúncio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Eventos e Logs */}
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
                {[
                  {
                    icon: CheckCircle2,
                    label: "Conexão estabelecida",
                    value: isConnected ? "Ativo" : "Aguardando",
                    ok: isConnected,
                  },
                  {
                    icon: ClipboardList,
                    label: "Última atualização",
                    value: status?.connectedAt
                      ? new Date(status.connectedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "—",
                    ok: false,
                  },
                  {
                    icon: BarChart2,
                    label: "Eventos recebidos",
                    value: "0",
                    ok: true,
                  },
                ].map(({ icon: Icon, label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${ok ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className={`text-xs font-medium ${ok && isConnected ? "text-emerald-400" : "text-white"}`}>{value}</span>
                  </div>
                ))}
              </div>
              {!isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-8 text-xs"
                >
                  {connecting
                    ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                    : <Link2 className="w-3 h-3 mr-1.5" />}
                  Conectar conta
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Analytics */}
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
                Acompanhe visualizações, engajamento e seguidores diretamente na plataforma.
              </p>
              <div className="grid grid-cols-2 gap-2 py-1">
                {[
                  { icon: Users, label: "Seguidores", value: "—" },
                  { icon: BarChart2, label: "Visualizações", value: "—" },
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
