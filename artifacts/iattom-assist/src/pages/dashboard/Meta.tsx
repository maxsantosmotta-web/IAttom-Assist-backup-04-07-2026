import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Instagram, Facebook, Loader2, X, Info, Users, Globe,
  RefreshCw, ClipboardList, BarChart2, TrendingUp, Link2,
  AlertCircle, CheckCircle2, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
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
            <Button onClick={() => { action.onClick(); onClose(); }}
              className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold">
              {action.label}
            </Button>
          )}
          <Button onClick={onClose}
            variant={action ? "outline" : "default"}
            className={action
              ? "border-white/10 text-muted-foreground hover:text-white"
              : "w-full bg-primary text-black hover:bg-primary/90 font-semibold"}>
            {action ? "Fechar" : "Entendido"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

interface MetaPage {
  id: number;
  pageId: string;
  name: string;
  category?: string | null;
  instagramAccountId?: string | null;
}

interface MetaIgAccount {
  id: number;
  igId: string;
  name?: string | null;
  username?: string | null;
  followersCount?: string | null;
}

interface MetaEvent {
  id: number;
  platform?: string | null;
  eventType?: string | null;
  objectId?: string | null;
  receivedAt?: string | null;
}

export function Meta() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"facebook" | "instagram">("facebook");
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [igAccounts, setIgAccounts] = useState<MetaIgAccount[]>([]);
  const [events, setEvents] = useState<MetaEvent[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingIg, setLoadingIg] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const loadData = useCallback(async () => {
    setLoadingPages(true);
    setLoadingIg(true);
    setLoadingEvents(true);
    try {
      const [pgs, igs, evs] = await Promise.allSettled([
        apiFetch<MetaPage[]>("/api/meta/pages"),
        apiFetch<MetaIgAccount[]>("/api/meta/instagram-accounts"),
        apiFetch<MetaEvent[]>("/api/meta/events"),
      ]);
      if (pgs.status === "fulfilled") setPages(pgs.value);
      if (igs.status === "fulfilled") setIgAccounts(igs.value);
      if (evs.status === "fulfilled") setEvents(evs.value);
    } finally {
      setLoadingPages(false);
      setLoadingIg(false);
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleConnect = (platform: "facebook" | "instagram") => {
    const name = platform === "facebook" ? "Facebook" : "Instagram";
    showInfo(
      `Conectar ${name}`,
      `A integração com ${name} requer configuração do Meta App (App ID + App Secret) pelo administrador da plataforma. Após a configuração, suas páginas e perfis serão sincronizados automaticamente. Esta função está preparada para próxima etapa.`,
    );
  };

  const handleSyncPosts = async () => {
    setSyncing(true);
    try {
      await apiFetch<{ ok: boolean }>("/api/meta/sync-pages", { method: "POST" });
      toast({ description: "Sincronização de páginas concluída." });
      void loadData();
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403 || e.status === 401) {
        showInfo(
          "Sincronizar Meta",
          "A sincronização de páginas e perfis é uma operação administrativa. Configure o Meta App no painel ADM e realize a sincronização por lá.",
        );
      } else {
        toast({ description: "Sincronização disponível após configuração do Meta App." });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateCampaign = (channel: string = "meta") => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ channel }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Abrindo criação de campanha Meta." });
  };

  const platformColor = (p: string | null | undefined) =>
    p === "instagram"
      ? "bg-pink-500/15 text-pink-400 border-pink-500/30"
      : "bg-blue-500/15 text-blue-400 border-blue-500/30";

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Meta — Facebook & Instagram</h1>
              <p className="text-xs text-muted-foreground">Gerencie páginas, perfis e campanhas Meta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => void handleSyncPosts()}
              disabled={syncing}
              className="border-white/10 text-muted-foreground hover:text-white">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              Sincronizar
            </Button>
            <Button size="sm"
              onClick={() => handleCreateCampaign("meta")}
              className="bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 text-white font-semibold">
              <ClipboardList className="w-3.5 h-3.5 mr-2" />
              Criar Campanha Meta
            </Button>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {/* Facebook Status */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Facebook className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Facebook</p>
                </div>
                {pages.length > 0
                  ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Conectado</Badge>
                  : <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-xs">Não conectado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {pages.length > 0
                  ? `${pages.length} página(s) conectada(s)`
                  : "Conecte sua conta Facebook para gerenciar páginas e campanhas."}
              </p>
              <div className="flex gap-2">
                <Button size="sm"
                  onClick={() => handleConnect("facebook")}
                  variant="outline"
                  className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs h-7">
                  <Link2 className="w-3 h-3 mr-1.5" />
                  Conectar Facebook
                </Button>
                <Button size="sm"
                  onClick={() => handleCreateCampaign("facebook")}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7">
                  Campanha FB
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instagram Status */}
          <Card className="bg-[#111111] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Instagram</p>
                </div>
                {igAccounts.length > 0
                  ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Conectado</Badge>
                  : <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-xs">Não conectado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {igAccounts.length > 0
                  ? `${igAccounts.length} conta(s) conectada(s)`
                  : "Conecte sua conta Instagram Business para gerenciar perfis e campanhas."}
              </p>
              <div className="flex gap-2">
                <Button size="sm"
                  onClick={() => handleConnect("instagram")}
                  variant="outline"
                  className="flex-1 border-pink-500/30 text-pink-400 hover:bg-pink-500/10 text-xs h-7">
                  <Link2 className="w-3 h-3 mr-1.5" />
                  Conectar Instagram
                </Button>
                <Button size="sm"
                  onClick={() => handleCreateCampaign("instagram")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs h-7">
                  Campanha IG
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Globe, label: "Páginas FB", value: String(pages.length), color: "text-blue-400" },
            { icon: Instagram, label: "Contas IG", value: String(igAccounts.length), color: "text-pink-400" },
            { icon: MessageSquare, label: "Eventos", value: String(events.length), color: "text-primary" },
            { icon: BarChart2, label: "Campanhas", value: "0", color: "text-muted-foreground" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="bg-[#111111] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-xl font-bold text-white">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: Pages / IG Accounts */}
        <div className="flex gap-1 p-1 bg-[#111111] border border-white/[0.06] rounded-lg w-fit mb-4">
          {([
            { id: "facebook", label: "Páginas Facebook", icon: Facebook },
            { id: "instagram", label: "Contas Instagram", icon: Instagram },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === id ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Facebook Pages */}
        {activeTab === "facebook" && (
          <Card className="bg-[#111111] border-white/[0.06] mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  Páginas Facebook
                  {pages.length > 0 && (
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">{pages.length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="ghost"
                  onClick={() => void handleSyncPosts()}
                  disabled={syncing || loadingPages}
                  className="text-muted-foreground hover:text-white h-7 px-2">
                  {loadingPages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPages ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando páginas...</span>
                </div>
              ) : pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Facebook className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Nenhuma página conectada</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                    Conecte sua conta Facebook Business para sincronizar páginas e começar a criar campanhas.
                  </p>
                  <Button size="sm"
                    onClick={() => handleConnect("facebook")}
                    className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                    <Link2 className="w-3.5 h-3.5 mr-2" />
                    Conectar Facebook
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pages.map((page) => (
                    <div key={page.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Facebook className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{page.name}</p>
                        {page.category && (
                          <p className="text-xs text-muted-foreground">{page.category}</p>
                        )}
                      </div>
                      <Button size="sm"
                        onClick={() => handleCreateCampaign("facebook")}
                        className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs h-7 shrink-0">
                        <ClipboardList className="w-3 h-3 mr-1.5" />
                        Campanha
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instagram Accounts */}
        {activeTab === "instagram" && (
          <Card className="bg-[#111111] border-white/[0.06] mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                  Contas Instagram Business
                  {igAccounts.length > 0 && (
                    <Badge className="bg-pink-500/15 text-pink-400 border-pink-500/30 text-xs">{igAccounts.length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="ghost"
                  onClick={() => void handleSyncPosts()}
                  disabled={syncing || loadingIg}
                  className="text-muted-foreground hover:text-white h-7 px-2">
                  {loadingIg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingIg ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando contas...</span>
                </div>
              ) : igAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Instagram className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Nenhuma conta Instagram conectada</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                    Conecte um perfil Instagram Business vinculado a uma Página Facebook para começar.
                  </p>
                  <Button size="sm"
                    onClick={() => handleConnect("instagram")}
                    className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold">
                    <Link2 className="w-3.5 h-3.5 mr-2" />
                    Conectar Instagram
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {igAccounts.map((acc) => (
                    <div key={acc.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                        <Instagram className="w-4 h-4 text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {acc.username ? `@${acc.username}` : acc.name ?? "—"}
                        </p>
                        {acc.followersCount && (
                          <p className="text-xs text-muted-foreground">{acc.followersCount} seguidores</p>
                        )}
                      </div>
                      <Button size="sm"
                        onClick={() => handleCreateCampaign("instagram")}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs h-7 shrink-0">
                        <ClipboardList className="w-3 h-3 mr-1.5" />
                        Campanha
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Events */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                Eventos Recentes
                {events.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{events.length}</Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="ghost"
                onClick={() => void loadData()}
                disabled={loadingEvents}
                className="text-muted-foreground hover:text-white h-7 px-2">
                {loadingEvents ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6">
                Nenhum evento registrado. Configure o webhook Meta para receber notificações.
              </p>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 10).map((ev) => (
                  <div key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5">
                    <Badge className={`text-xs border shrink-0 ${ev.platform === "instagram"
                      ? "bg-pink-500/15 text-pink-400 border-pink-500/30"
                      : "bg-blue-500/15 text-blue-400 border-blue-500/30"}`}>
                      {ev.platform === "instagram" ? "IG" : "FB"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{ev.eventType ?? "—"}</p>
                      {ev.objectId && <p className="text-[10px] text-muted-foreground font-mono">{ev.objectId}</p>}
                    </div>
                    {ev.receivedAt && (
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {new Date(ev.receivedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
