import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, RefreshCw, Loader2, ExternalLink, Trash2,
  Eye, Package, AlertTriangle, CheckCircle2, Link2, Plus,
  DollarSign, Boxes, Tag, Clock, AlertCircle, X, Info,
  Megaphone, Image, Video, Sparkles, BarChart2, TrendingUp,
  FileText, Search, Zap, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Types ─────────────────────────────────────────────────── */
interface MLStatus {
  connected: boolean;
  nickname: string | null;
  tokenExpired: boolean;
  appConfigured: boolean;
  siteId: string | null;
}

interface MLListing {
  id: number;
  mlItemId: string;
  title?: string | null;
  price?: string | null;
  availableQuantity?: number | null;
  status?: string | null;
  permalink?: string | null;
  categoryId?: string | null;
  syncedAt?: string | null;
}

interface MLEvent {
  id: number;
  topic?: string | null;
  resource?: string | null;
  userId?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:       { label: "Ativo",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  paused:       { label: "Pausado",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  closed:       { label: "Encerrado",  color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  under_review: { label: "Em Revisão", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

function getStatusInfo(status: string | null | undefined) {
  return STATUS_LABELS[status ?? ""] ?? { label: status ?? "—", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
}

/* ─── ConnectModal ──────────────────────────────────────────── */
function ConnectModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleOAuth = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/me/ml/oauth-url");
      window.open(data.url, "_blank");
      toast({ description: "Abrindo autorização Mercado Livre em nova aba." });
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Configuração não disponível. O administrador deve configurar o app ML primeiro.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Conectar Mercado Livre</p>
              <p className="text-xs text-muted-foreground">Autorize o acesso à sua conta</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 flex gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Conecte sua conta Mercado Livre para gerenciar seus anúncios. O botão abaixo iniciará a autorização OAuth — sua conta ficará conectada após autorizar.
          </p>
        </div>
        <div className="space-y-2">
          <Button onClick={() => void handleOAuth()} disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
            Iniciar autorização OAuth
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full border-white/10 text-muted-foreground hover:text-white">
            Cancelar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── CreateListingModal ────────────────────────────────────── */
function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", price: "", quantity: "1" });

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast({ variant: "destructive", description: "Informe o título do anúncio." }); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) { toast({ variant: "destructive", description: "Informe um preço válido." }); return; }
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; item: { id: string; permalink: string } }>(
        "/api/me/ml/create-listing",
        { method: "POST", body: JSON.stringify({ title: form.title, price, quantity: parseInt(form.quantity) || 1 }) },
      );
      toast({ description: `Anúncio criado: ${data.item.id}` });
      onCreated();
      onClose();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao criar anúncio." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Criar Anúncio</p>
            <p className="text-xs text-muted-foreground mt-0.5">Publicar novo item no Mercado Livre</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Título do Anúncio</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Tênis Esportivo Nike Air Max" className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Preço (R$)</Label>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="99.90" min="1" className="bg-[#0a0a0a] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Quantidade</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="1" min="1" className="bg-[#0a0a0a] border-white/10 text-white" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Anúncio criado como tipo Bronze na categoria geral. Edite diretamente no Mercado Livre para ajustar categoria, fotos e demais atributos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void handleSubmit()} disabled={loading} className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar Anúncio
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-muted-foreground hover:text-white">Cancelar</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── DetailModal ───────────────────────────────────────────── */
function DetailModal({ listing, onClose }: { listing: MLListing; onClose: () => void }) {
  const statusInfo = getStatusInfo(listing.status);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-lg p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-white line-clamp-2">{listing.title ?? "Sem título"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ID: {listing.mlItemId}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: DollarSign, label: "Preço",      value: listing.price ? `R$ ${listing.price}` : "—" },
            { icon: Boxes,      label: "Estoque",     value: String(listing.availableQuantity ?? "—") },
            { icon: Tag,        label: "Categoria",   value: listing.categoryId ?? "—" },
            { icon: Clock,      label: "Sincronizado", value: listing.syncedAt ? new Date(listing.syncedAt).toLocaleDateString("pt-BR") : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Status:</p>
          <Badge className={`text-xs border ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>
        <div className="flex gap-2">
          {listing.permalink && (
            <Button onClick={() => window.open(listing.permalink!, "_blank")} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Ver no Mercado Livre
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="border-white/10 text-muted-foreground hover:text-white" size="sm">Fechar</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── InfoModal ─────────────────────────────────────────────── */
function InfoModal({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <Button onClick={onClose} className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">Entendido</Button>
      </motion.div>
    </div>
  );
}

/* ─── MercadoLivre ──────────────────────────────────────────── */
export function MercadoLivre() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [status, setStatus]               = useState<MLStatus | null>(null);
  const [listings, setListings]           = useState<MLListing[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingListings, setLoadingListings] = useState(false);
  const [syncing, setSyncing]             = useState(false);
  const [showConnect, setShowConnect]     = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedListing, setSelectedListing] = useState<MLListing | null>(null);
  const [trashingId, setTrashingId]       = useState<number | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [infoModal, setInfoModal]         = useState<{ title: string; description: string } | null>(null);
  const [aiLoading, setAiLoading]         = useState<string | null>(null);

  /* ── data loaders ─────────────────────────────────────────── */
  const loadStatus = useCallback(async () => {
    try {
      const data = await apiFetch<MLStatus>("/api/me/ml/status");
      setStatus(data);
    } catch {
      setStatus({ connected: false, nickname: null, tokenExpired: false, appConfigured: false, siteId: null });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const data = await apiFetch<MLListing[]>("/api/me/ml/listings");
      setListings(data);
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao carregar anúncios." });
    } finally {
      setLoadingListings(false);
    }
  }, [toast]);

  const loadEvents = useCallback(async () => {
    try { await apiFetch<MLEvent[]>("/api/me/ml/events"); } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadListings();
    void loadEvents();
  }, [loadStatus, loadListings, loadEvents]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ml_connected") === "1") {
      toast({ description: "Conta Mercado Livre conectada com sucesso." });
      window.history.replaceState({}, "", window.location.pathname);
      void loadStatus();
      void loadListings();
    } else if (params.get("ml_error")) {
      const errMsg = decodeURIComponent(params.get("ml_error") ?? "Erro desconhecido");
      toast({ variant: "destructive", description: `Falha ao conectar Mercado Livre: ${errMsg}` });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast, loadStatus, loadListings]);

  /* ── actions ──────────────────────────────────────────────── */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await apiFetch<{ ok: boolean; synced: number }>("/api/me/ml/sync", { method: "POST" });
      toast({ description: `Sincronização concluída — ${data.synced} anúncio(s) atualizados.` });
      await loadListings();
      await loadStatus();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha na sincronização." });
    } finally {
      setSyncing(false);
    }
  };

  const handleTrash = async (listing: MLListing) => {
    setTrashingId(listing.id);
    try {
      await apiFetch<{ ok: boolean }>(`/api/me/ml/listings/${listing.id}/trash`, { method: "POST" });
      toast({ description: `"${listing.title ?? "Anúncio"}" movido para a lixeira.` });
      setListings(prev => prev.filter(l => l.id !== listing.id));
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao mover para lixeira." });
    } finally {
      setTrashingId(null);
    }
  };

  const handleCreateCampaign = (listing?: MLListing) => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ product: listing?.title ?? "", goal: "Vender no Mercado Livre" }));
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados carregados na criação de campanha." });
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch<{ ok: boolean }>("/api/me/ml/disconnect", { method: "POST" });
      setShowDisconnect(false);
      toast({ description: "Conta Mercado Livre desconectada." });
      void loadStatus();
    } catch {
      setShowDisconnect(false);
      toast({ variant: "destructive", description: "Falha ao desconectar. Tente novamente." });
    }
  };

  const handleAiAction = async (key: string, title: string, desc: string) => {
    setAiLoading(key);
    await new Promise(r => setTimeout(r, 600));
    setAiLoading(null);
    setInfoModal({ title, description: desc });
  };

  /* ── derived ──────────────────────────────────────────────── */
  const activeCount  = listings.filter(l => l.status === "active").length;
  const pausedCount  = listings.filter(l => l.status === "paused").length;

  return (
    <div className="space-y-6">
      {/* ── Modals ──────────────────────────────────────────── */}
      {showConnect    && <ConnectModal onClose={() => setShowConnect(false)} />}
      {showCreate     && <CreateListingModal onClose={() => setShowCreate(false)} onCreated={() => { void loadListings(); }} />}
      {selectedListing && <DetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} />}
      {infoModal      && <InfoModal title={infoModal.title} description={infoModal.description} onClose={() => setInfoModal(null)} />}

      {/* Disconnect confirm */}
      {showDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Desconectar conta</p>
                  <p className="text-xs text-muted-foreground">Mercado Livre</p>
                </div>
              </div>
              <button onClick={() => setShowDisconnect(false)} className="text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Deseja desconectar esta conta? Seus anúncios sincronizados serão mantidos.</p>
            <div className="space-y-2">
              <Button onClick={() => void handleDisconnect()} className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold">
                Confirmar desconexão
              </Button>
              <Button variant="outline" onClick={() => setShowDisconnect(false)} className="w-full border-white/10 text-muted-foreground hover:text-white">
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Mercado Livre</h1>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                Conecte sua conta Mercado Livre, otimize anúncios, acompanhe produtos e crie campanhas com IA.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status?.connected && (
              <>
                <Button onClick={() => void handleSync()} disabled={syncing} variant="outline" size="sm"
                  className="border-white/10 text-muted-foreground hover:text-white h-8 gap-1.5 text-xs">
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sincronizar
                </Button>
                <Button onClick={() => setShowCreate(true)} size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold h-8 gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Criar Anúncio
                </Button>
              </>
            )}
            {!status?.connected && !loadingStatus && (
              <Button onClick={() => setShowConnect(true)} size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold h-8 gap-1.5 text-xs">
                <Link2 className="w-3.5 h-3.5" /> Conectar Mercado Livre
              </Button>
            )}
            {loadingStatus && (
              <Badge className="bg-white/5 text-muted-foreground border-white/10 gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
              </Badge>
            )}
          </div>
        </div>

        {/* ── A) Minha Conta ────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              Minha Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Verificando conexão...</p>
              </div>
            ) : status?.connected ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Conta conectada</span>
                  </div>
                  {status.nickname && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">@{status.nickname}</Badge>
                  )}
                  {status.siteId && (
                    <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px]">Site: {status.siteId}</Badge>
                  )}
                  {status.tokenExpired && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-xs text-yellow-400">Token expirado — reconecte</span>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowDisconnect(true)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto h-7 text-xs">
                    Desconectar
                  </Button>
                </div>
                {/* KPIs rápidos */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
                  {[
                    { label: "Anúncios", value: listings.length || "—", color: "text-white" },
                    { label: "Ativos",   value: activeCount  || "—", color: "text-emerald-400" },
                    { label: "Pausados", value: pausedCount  || "—", color: "text-yellow-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Conta não conectada</span>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  {status?.appConfigured
                    ? "App configurado — clique em Conectar para autorizar."
                    : "Aguarde a liberação da plataforma para conectar."}
                </p>
                <Button size="sm" onClick={() => setShowConnect(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold ml-auto h-8 text-xs gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Conectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── B) Produtos e Anúncios ────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                Produtos e Anúncios
                {listings.length > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-xs">{listings.length}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadListings()} disabled={loadingListings}
                  className="h-7 px-2 border-white/10 text-muted-foreground hover:text-white text-xs gap-1">
                  {loadingListings ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Sincronizar
                </Button>
                {status?.connected && (
                  <Button size="sm" onClick={() => setShowCreate(true)}
                    className="h-7 px-3 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/25 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Criar anúncio
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingListings ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando anúncios...</span>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mb-1">
                  <Package className="w-5 h-5 text-amber-400/30" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Nenhum anúncio encontrado</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  {status?.connected
                    ? "Clique em Sincronizar para buscar seus anúncios do ML, ou crie um novo."
                    : "Conecte sua conta Mercado Livre para visualizar seus anúncios."}
                </p>
                {status?.connected && (
                  <Button size="sm" onClick={() => void handleSync()} disabled={syncing}
                    className="mt-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                    Sincronizar Anúncios
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {listings.map(listing => {
                  const si = getStatusInfo(listing.status);
                  return (
                    <div key={listing.id} className="bg-[#0d0d0d] border border-white/5 rounded-xl p-4 space-y-3 hover:border-amber-500/20 transition-colors">
                      {/* title + badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{listing.title ?? "Sem título"}</p>
                        <Badge className={`text-[10px] border shrink-0 ${si.color}`}>{si.label}</Badge>
                      </div>
                      {/* price + stock */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-amber-400">{listing.price ? `R$ ${listing.price}` : "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{listing.availableQuantity ?? 0} un.</span>
                        </div>
                      </div>
                      {/* actions */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                        <Button size="sm" variant="outline" onClick={() => setSelectedListing(listing)}
                          className="h-7 px-2 border-white/10 text-muted-foreground hover:text-white text-xs gap-1">
                          <Eye className="w-3 h-3" /> Detalhes
                        </Button>
                        {listing.permalink && (
                          <Button size="sm" variant="outline" onClick={() => window.open(listing.permalink!, "_blank")}
                            className="h-7 px-2 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 text-xs gap-1">
                            <ExternalLink className="w-3 h-3" /> Ver no ML
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleCreateCampaign(listing)}
                          className="h-7 px-2 text-muted-foreground hover:text-primary text-xs gap-1">
                          <Megaphone className="w-3 h-3" /> Campanha
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleTrash(listing)} disabled={trashingId === listing.id}
                          className="h-7 px-2 text-muted-foreground hover:text-red-400 text-xs ml-auto">
                          {trashingId === listing.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── C) Otimização com IA ──────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Otimização com IA
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">IA</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  key: "title",  icon: FileText, color: "text-blue-400",   bg: "bg-blue-500/8 border-blue-500/15",
                  label: "Melhorar Título",
                  desc:  "Reescreva o título do seu anúncio com palavras-chave estratégicas e mais cliques.",
                },
                {
                  key: "desc",   icon: FileText, color: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/15",
                  label: "Melhorar Descrição",
                  desc:  "Gere uma descrição persuasiva e otimizada para conversão no Mercado Livre.",
                },
                {
                  key: "kw",     icon: Search,   color: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15",
                  label: "Sugerir Palavras-chave",
                  desc:  "Descubra as melhores palavras-chave para aumentar a visibilidade do seu anúncio.",
                },
                {
                  key: "price",  icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/15",
                  label: "Analisar Preço",
                  desc:  "Análise comparativa de preço com base no mercado atual para maximizar competitividade.",
                },
                {
                  key: "img",    icon: Image,    color: "text-pink-400",   bg: "bg-pink-500/8 border-pink-500/15",
                  label: "Otimizar Imagem",
                  desc:  "Gere sugestões de composição visual e melhore a imagem principal do anúncio.",
                },
              ].map(({ key, icon: Icon, color, bg, label, desc }) => (
                <button
                  key={key}
                  disabled={aiLoading !== null}
                  onClick={() => void handleAiAction(key, label, `Função preparada para próxima etapa. ${desc}`)}
                  className={`group flex items-start gap-3 p-4 rounded-xl border ${bg} hover:opacity-80 transition-all text-left`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-black/20`}>
                    {aiLoading === key ? <Loader2 className={`w-4 h-4 animate-spin ${color}`} /> : <Icon className={`w-4 h-4 ${color}`} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── D) Campanhas ─────────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              Campanhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Criar campanha Mercado Livre", icon: Megaphone,
                  desc:  "Monte uma campanha completa usando o contexto dos seus anúncios.",
                  action: () => handleCreateCampaign(),
                  highlight: true,
                },
                {
                  label: "Gerar copy de anúncio", icon: FileText,
                  desc:  "Crie textos persuasivos prontos para usar em anúncios patrocinados.",
                  action: () => setInfoModal({ title: "Gerar Copy", description: "Função preparada para próxima etapa — geração de copy para anúncios ML via IA." }),
                },
                {
                  label: "Gerar imagem de campanha", icon: Image,
                  desc:  "Crie criativos visuais para divulgar seus produtos ML.",
                  action: () => { sessionStorage.setItem("iattom_creative_prefill", JSON.stringify({ platform: "Mercado Livre" })); navigate("/dashboard/creative-generator"); toast({ description: "Gerador de imagens aberto com contexto ML." }); },
                },
                {
                  label: "Gerar script de venda", icon: Video,
                  desc:  "Monte um script de vendas para vídeo ou áudio focado nos seus produtos.",
                  action: () => { sessionStorage.setItem("iattom_script_prefill", JSON.stringify({ platform: "Mercado Livre" })); navigate("/dashboard/video-scripts"); toast({ description: "Gerador de scripts aberto com contexto ML." }); },
                },
              ].map(({ label, icon: Icon, desc, action, highlight }) => (
                <button key={label} onClick={action}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left hover:opacity-80 ${
                    highlight ? "bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40" : "bg-white/3 border-white/8 hover:border-white/14"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-amber-500/15" : "bg-white/5"}`}>
                    <Icon className={`w-4 h-4 ${highlight ? "text-amber-400" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${highlight ? "text-amber-300" : "text-white"}`}>{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── E) Performance ───────────────────────────────── */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Visitas",    icon: Eye,        value: "—", color: "text-blue-400"    },
                { label: "Vendas",     icon: TrendingUp, value: "—", color: "text-emerald-400" },
                { label: "Potencial",  icon: Star,       value: "—", color: "text-amber-400"   },
                { label: "Otimização", icon: Zap,        value: "—", color: "text-primary"     },
              ].map(({ label, icon: Icon, value, color }) => (
                <div key={label} className="p-3 rounded-xl bg-white/3 border border-white/6 text-center">
                  <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/3 border border-white/6">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Métricas de performance por anúncio estarão disponíveis após a integração com a API de Analytics do Mercado Livre. Conecte sua conta para acelerar a ativação.
              </p>
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
