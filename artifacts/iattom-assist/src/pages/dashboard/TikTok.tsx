import { useState } from "react";
import { motion } from "framer-motion";
import {
  Music2, Link2, Loader2, X, Info, AlertCircle,
  Megaphone, ShoppingBag, Video, ClipboardList, ExternalLink,
  CheckCircle2, Zap, Play, BarChart2, Users, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
  const [, navigate] = useLocation();
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const showInfo = (
    title: string,
    description: string,
    action?: { label: string; onClick: () => void },
  ) => setModal({ title, description, action });

  const handleConnect = async () => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 900));
    setConnecting(false);
    showInfo(
      "Conectar TikTok",
      "A integração com TikTok requer credenciais da TikTok Developer Platform (App ID + App Secret). O administrador deve configurar o app e autorizar o acesso via OAuth. Esta função está preparada para a próxima etapa da plataforma.",
    );
  };

  const handleCreateAdsCampaign = () => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ channel: "tiktok_ads", platform: "tiktok" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Abrindo criação de campanha com TikTok pré-selecionado." });
  };

  const handleTikTokShop = () => {
    showInfo(
      "TikTok Shop",
      "A integração com TikTok Shop permite vender produtos diretamente nos seus vídeos. Requer conta TikTok Shop aprovada e credenciais de parceiro. Função preparada para próxima etapa.",
    );
  };

  const handleViewVideoScripts = () => {
    navigate("/dashboard/video-scripts");
    toast({ description: "Abrindo gerador de scripts de vídeo." });
  };

  const handleAnalytics = () => {
    showInfo(
      "Analytics TikTok",
      "As métricas de performance dos seus vídeos e campanhas TikTok estarão disponíveis aqui após a conexão da conta. Função preparada para próxima etapa.",
    );
  };

  const handleCreateCampaignTikTok = () => {
    showInfo(
      "Criar Campanha TikTok",
      "Você pode criar campanhas para o TikTok usando o módulo Criar Campanha, com o canal TikTok selecionado. Deseja ir para lá agora?",
      { label: "Criar Campanha", onClick: handleCreateAdsCampaign },
    );
  };

  const handlePlaceholder = (label: string) => {
    toast({ description: `Função preparada para próxima etapa — ${label}.` });
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
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TikTok</h1>
              <p className="text-xs text-muted-foreground">Gerencie anúncios, conteúdo e sua presença no TikTok</p>
            </div>
          </div>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold"
            size="sm"
          >
            {connecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <Link2 className="w-3.5 h-3.5 mr-2" />
            )}
            Conectar TikTok
          </Button>
        </div>

        {/* Status Card */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Conta TikTok não conectada</span>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Conecte sua conta para acessar Ads, Shop e publicação de conteúdo.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={connecting}
                className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 ml-auto"
              >
                {connecting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Link2 className="w-3 h-3 mr-1.5" />}
                Conectar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          {/* TikTok Ads */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">TikTok Ads</CardTitle>
                  <p className="text-xs text-muted-foreground">Campanhas e anúncios pagos</p>
                </div>
                <Badge className="ml-auto bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Em breve</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crie e gerencie campanhas de anúncios no TikTok For Business. Segmentação por interesse, lookalike e retargeting.
              </p>
              <div className="grid grid-cols-3 gap-2 py-1">
                {[
                  { icon: BarChart2, label: "Impressões", value: "—" },
                  { icon: Users, label: "Alcance", value: "—" },
                  { icon: TrendingUp, label: "CTR", value: "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2 rounded bg-white/5 text-center">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-semibold text-white">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateCampaignTikTok}
                  className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold h-8 text-xs"
                >
                  <Megaphone className="w-3 h-3 mr-1.5" />
                  Criar Campanha TikTok
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAnalytics}
                  className="border-white/10 text-muted-foreground hover:text-white h-8 px-2"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* TikTok Shop */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">TikTok Shop</CardTitle>
                  <p className="text-xs text-muted-foreground">Venda dentro do app</p>
                </div>
                <Badge className="ml-auto bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Em breve</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Conecte sua loja TikTok Shop para vender produtos diretamente nos seus vídeos e lives, sem sair do app.
              </p>
              <div className="space-y-2">
                <Button
                  size="sm"
                  onClick={handleTikTokShop}
                  className="w-full bg-orange-500/80 hover:bg-orange-500 text-white font-semibold h-8 text-xs"
                >
                  <Link2 className="w-3 h-3 mr-1.5" />
                  Conectar TikTok Shop
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePlaceholder("sincronizar produtos TikTok Shop")}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
                >
                  Sincronizar Produtos
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vídeos / Conteúdo */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Video className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Vídeos e Conteúdo</CardTitle>
                  <p className="text-xs text-muted-foreground">Scripts e publicação</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gere scripts de vídeo otimizados para o TikTok com IA. Planeje sua grade de conteúdo e agende publicações.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={handleViewVideoScripts}
                  className="w-full bg-primary text-black hover:bg-primary/90 font-semibold h-8 text-xs"
                >
                  <Play className="w-3 h-3 mr-1.5" />
                  Gerar Script de Vídeo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => showInfo(
                    "Publicação de Vídeos",
                    "A publicação direta no TikTok via API estará disponível após a conexão da conta. Você poderá agendar e publicar vídeos diretamente da plataforma. Função preparada para próxima etapa.",
                  )}
                  className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Publicação de Vídeos
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Métricas / Logs */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-white">Eventos e Logs</CardTitle>
                  <p className="text-xs text-muted-foreground">Histórico de ações</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 py-2">
                {[
                  { icon: CheckCircle2, label: "Conexão estabelecida", value: "Aguardando", ok: false },
                  { icon: ClipboardList, label: "Última sincronização", value: "—", ok: false },
                  { icon: BarChart2, label: "Eventos recebidos", value: "0", ok: true },
                ].map(({ icon: Icon, label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${ok ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xs font-medium text-white">{value}</span>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-8 text-xs"
              >
                {connecting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Link2 className="w-3 h-3 mr-1.5" />}
                Conectar para ativar logs
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
