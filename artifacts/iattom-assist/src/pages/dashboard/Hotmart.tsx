import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Flame, X, Info, AlertCircle,
  Megaphone, ClipboardList, Link2,
  CheckCircle2, BarChart2, Package, TrendingUp,
  Loader2, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface HotmartStatus {
  connected?: boolean;
  isActive?: boolean;
  [key: string]: unknown;
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

export function Hotmart() {
  const { toast } = useToast();

  const [modal, setModal] = useState<{
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${BASE}/api/hotmart/user/integration-status`, { credentials: "include" });
      if (!res.ok) { setIsConnected(false); return; }
      const data = (await res.json()) as HotmartStatus;
      setIsConnected(!!(data.connected || data.isActive));
    } catch {
      setIsConnected(false);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleConnect = () => {
    showInfo(
      "Conectar Hotmart",
      "A conexão com Hotmart estará disponível em breve. Após ativar, você poderá acessar produtos, campanhas e vendas diretamente aqui.",
    );
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${BASE}/api/hotmart/user/disconnect`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Falha ao desconectar.");
      setIsConnected(false);
      toast({ description: "Conta Hotmart desconectada." });
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
      "Análise Hotmart",
      "As métricas de performance estarão disponíveis após a conexão da conta.",
    );
  };

  const handleCriarCampanha = () => {
    sessionStorage.setItem("campaign_platform_context", JSON.stringify({ platform: "hotmart" }));
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = () => {
    sessionStorage.setItem("content_platform_context", JSON.stringify({ platform: "hotmart" }));
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  const handleCriarAnuncio = () => {
    window.open("https://app.hotmart.com/products", "_blank", "noopener,noreferrer");
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

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Hotmart</h1>
              <p className="text-xs text-muted-foreground">Gerencie produtos, campanhas e suas vendas na Hotmart</p>
            </div>
          </div>
          <Button
            onClick={isConnected ? undefined : handleConnect}
            disabled={isConnected || statusLoading}
            className={
              isConnected
                ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default font-semibold"
                : "bg-orange-500 hover:bg-orange-400 text-white font-semibold"
            }
            size="sm"
          >
            {statusLoading
              ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              : isConnected
                ? <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                : <Link2 className="w-3.5 h-3.5 mr-2" />}
            {statusLoading ? "Verificando..." : isConnected ? "Conta conectada" : "Conectar Hotmart"}
          </Button>
        </div>

        {/* ── Status Card ──────────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {statusLoading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
              ) : isConnected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {statusLoading ? "Verificando conexão..." : isConnected ? "Conta Hotmart conectada" : "Conta Hotmart não conectada"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {isConnected
                    ? "Sua conta está ativa e sincronizada."
                    : "Conecte sua conta para acessar produtos, campanhas e vendas."}
                </p>
              </div>
              {!statusLoading && isConnected ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="text-red-400/70 hover:text-red-400 h-8 text-xs gap-1.5 ml-auto shrink-0"
                >
                  {disconnecting
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <LogOut className="w-3 h-3" />}
                  Desconectar
                </Button>
              ) : !statusLoading ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 ml-auto shrink-0"
                >
                  <Link2 className="w-3 h-3 mr-1.5" />
                  Conectar
                </Button>
              ) : null}
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
                Acompanhe suas campanhas da Hotmart. Visualizações, alcance e conversões disponíveis após conexão.
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
                {[
                  { icon: CheckCircle2, label: "Conexão",             value: isConnected ? "Ativa" : "Aguardando", ok: isConnected },
                  { icon: Package,      label: "Produtos conectados", value: "—",                                  ok: false },
                  { icon: BarChart2,    label: "Eventos recebidos",   value: "—",                                  ok: false },
                ].map(({ icon: Icon, label, value, ok }) => (
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
                  className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-8 text-xs"
                >
                  <Link2 className="w-3 h-3 mr-1.5" />
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
