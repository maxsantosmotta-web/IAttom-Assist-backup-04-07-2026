import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Loader2, ExternalLink, RefreshCw,
  Package, Megaphone, ClipboardList, FolderOpen,
  Sparkles, Search, CheckCircle2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ActivityByModule {
  module: string;
  count: number;
}

interface UserAnalytics {
  activityByModule: ActivityByModule[];
  days: number;
}

function getCount(activityByModule: ActivityByModule[], module: string): number {
  return activityByModule.find(m => m.module === module)?.count ?? 0;
}

export function MercadoLivre() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/analytics/user?days=30`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as UserAnalytics;
      setAnalytics(data);
    } catch {
      setAnalytics({ activityByModule: [], days: 30 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setContentVisible(false);
    await loadAnalytics();
    await new Promise(r => setTimeout(r, 150));
    setContentVisible(true);
    setIsRefreshing(false);
  }, [loadAnalytics]);

  const handleCriarAnuncio = () => {
    window.open("https://www.mercadolivre.com.br/publicar", "_blank", "noopener,noreferrer");
  };

  const handleCriarCampanha = () => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ goal: "Vender no Mercado Livre" }));
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = () => {
    sessionStorage.setItem("content_platform_context", JSON.stringify({ platform: "mercadolivre" }));
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  const handleProjetosSalvos = () => {
    window.location.href = `${BASE}/dashboard/projects`;
  };

  const activity = analytics?.activityByModule ?? [];

  return (
    <div className="space-y-6">
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || loading}
              className="border-white/10 text-zinc-400 hover:text-white gap-1.5 text-xs"
            >
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Atualizar
            </Button>
            <Button
              onClick={handleCriarAnuncio}
              className="bg-primary hover:bg-primary/90 text-black font-semibold"
              size="sm"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Criar anúncio
            </Button>
          </div>
        </div>

        {/* ── Publicação Assistida ──────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm text-white font-medium">Publicação Assistida</p>
                  <Badge className="bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    Acesso externo assistido
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Abra o Mercado Livre e publique seus anúncios utilizando os materiais criados no IAttom.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Feature Cards ─────────────────────────────────────── */}
        <motion.div
          animate={{ opacity: contentVisible ? 1 : 0 }}
          transition={{ duration: contentVisible ? 0.25 : 0.12 }}
        >
          <div className="grid md:grid-cols-2 gap-4">

            {/* Conteúdo */}
            <Card className="bg-[#111111] border-white/[0.06]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-amber-400" />
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
                    onClick={handleProjetosSalvos}
                    className="w-full border-white/10 text-muted-foreground hover:text-white h-8 text-xs"
                  >
                    <FolderOpen className="w-3 h-3 mr-1.5" />
                    Projetos salvos
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
                <div className="space-y-1 py-1">
                  {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">Carregando...</span>
                    </div>
                  ) : (
                    [
                      { icon: Megaphone,     label: "Criar Campanha", value: getCount(activity, "create-campaign") },
                      { icon: ClipboardList, label: "Criar Conteúdo", value: getCount(activity, "create-content") },
                      { icon: Sparkles,      label: "Criar Imagem",   value: getCount(activity, "creative-generator") },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{value}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/50">Dados dos últimos 30 dias</p>
              </CardContent>
            </Card>

            {/* Análise */}
            <Card className="bg-[#111111] border-white/[0.06] md:col-span-2">
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
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Carregando...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 py-1">
                    {[
                      { icon: Search,       label: "Buscar Produtos",  value: getCount(activity, "find-products") },
                      { icon: CheckCircle2, label: "Validar Produto",  value: getCount(activity, "validate-products") },
                      { icon: TrendingUp,   label: "Scripts de Vídeo", value: getCount(activity, "video-scripts") },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="p-3 rounded-lg bg-white/5 text-center">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1.5" />
                        <p className="text-sm font-semibold text-white">{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/50">Dados dos últimos 30 dias</p>
              </CardContent>
            </Card>

          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
