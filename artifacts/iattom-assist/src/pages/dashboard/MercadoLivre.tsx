import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, RefreshCw, Loader2, ExternalLink, Trash2,
  Eye, Package, AlertTriangle, CheckCircle2, Link2, Plus,
  DollarSign, Boxes, Tag, Clock, AlertCircle, X, Info,
  ClipboardList, ChevronDown, ChevronUp,
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
  active:    { label: "Ativo",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  paused:    { label: "Pausado",   color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  closed:    { label: "Encerrado", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  under_review: { label: "Em Revisão", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

function getStatusInfo(status: string | null | undefined) {
  return STATUS_LABELS[status ?? ""] ?? { label: status ?? "—", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
}

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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
            A integração ML é gerenciada pelo administrador da plataforma. O botão abaixo iniciará o fluxo OAuth — após autorizar, a conexão ficará disponível para todos os usuários da plataforma.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleOAuth}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
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

function CreateListingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", price: "", quantity: "1" });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", description: "Informe o título do anúncio." });
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      toast({ variant: "destructive", description: "Informe um preço válido." });
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; item: { id: string; permalink: string } }>(
        "/api/me/ml/create-listing",
        {
          method: "POST",
          body: JSON.stringify({ title: form.title, price, quantity: parseInt(form.quantity) || 1 }),
        },
      );
      toast({ description: `Anúncio criado: ${data.item.id}` });
      onCreated();
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "Falha ao criar anúncio.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Tênis Esportivo Nike Air Max"
              className="bg-[#0a0a0a] border-white/10 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Preço (R$)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="99.90"
                min="1"
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Quantidade</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="1"
                min="1"
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Anúncio criado como tipo Bronze na categoria geral. Edite diretamente no Mercado Livre para ajustar categoria, fotos e demais atributos.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar Anúncio
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-muted-foreground hover:text-white">
            Cancelar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DetailModal({ listing, onClose }: { listing: MLListing; onClose: () => void }) {
  const statusInfo = getStatusInfo(listing.status);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
            { icon: DollarSign, label: "Preço", value: listing.price ? `R$ ${listing.price}` : "—" },
            { icon: Boxes, label: "Estoque", value: String(listing.availableQuantity ?? "—") },
            { icon: Tag, label: "Categoria", value: listing.categoryId ?? "—" },
            { icon: Clock, label: "Sincronizado", value: listing.syncedAt ? new Date(listing.syncedAt).toLocaleDateString("pt-BR") : "—" },
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
            <Button
              onClick={() => window.open(listing.permalink!, "_blank")}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              size="sm"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Ver no Mercado Livre
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="border-white/10 text-muted-foreground hover:text-white" size="sm">
            Fechar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function MercadoLivre() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [status, setStatus] = useState<MLStatus | null>(null);
  const [listings, setListings] = useState<MLListing[]>([]);
  const [events, setEvents] = useState<MLEvent[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingListings, setLoadingListings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MLListing | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [trashingId, setTrashingId] = useState<number | null>(null);

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
    try {
      const data = await apiFetch<MLEvent[]>("/api/me/ml/events");
      setEvents(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadListings();
    void loadEvents();
  }, [loadStatus, loadListings, loadEvents]);

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
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "Falha ao mover para lixeira." });
    } finally {
      setTrashingId(null);
    }
  };

  const handleCreateCampaign = (listing: MLListing) => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: listing.title ?? "", channel: "mercado_livre" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados do anúncio carregados na criação de campanha." });
  };

  return (
    <div className="space-y-6">
      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} />}
      {showCreate && (
        <CreateListingModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { void loadListings(); }}
        />
      )}
      {selectedListing && (
        <DetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} />
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mercado Livre</h1>
              <p className="text-xs text-muted-foreground">Gerencie seus anúncios e sincronize com sua conta ML</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.connected && (
              <>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                  Sincronizar
                </Button>
                <Button
                  onClick={() => setShowCreate(true)}
                  size="sm"
                  className="bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Criar Anúncio
                </Button>
              </>
            )}
            {!status?.connected && !loadingStatus && (
              <Button
                onClick={() => setShowConnect(true)}
                size="sm"
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              >
                <Link2 className="w-3.5 h-3.5 mr-2" />
                Conectar Mercado Livre
              </Button>
            )}
          </div>
        </div>

        {/* Status Card */}
        <Card className="bg-[#111111] border-white/[0.06] mb-5">
          <CardContent className="p-4">
            {loadingStatus ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Verificando conexão...</p>
              </div>
            ) : status?.connected ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Conta conectada</span>
                </div>
                {status.nickname && (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                    @{status.nickname}
                  </Badge>
                )}
                {status.tokenExpired && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Token expirado — o admin deve renovar</span>
                  </div>
                )}
                {status.siteId && (
                  <span className="text-xs text-muted-foreground">Site: {status.siteId}</span>
                )}
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
                    : "O administrador deve configurar o app Mercado Livre primeiro."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowConnect(true)}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 ml-auto"
                >
                  <Link2 className="w-3.5 h-3.5 mr-2" />
                  Conectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listings */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Meus Anúncios
                {listings.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{listings.length}</Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void loadListings()}
                disabled={loadingListings}
                className="text-muted-foreground hover:text-white h-7 px-2"
              >
                {loadingListings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingListings ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando anúncios...</span>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-10 h-10 text-white/10 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Nenhum anúncio encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  {status?.connected
                    ? "Clique em Sincronizar para buscar seus anúncios do ML, ou crie um novo anúncio."
                    : "Conecte sua conta Mercado Livre para visualizar seus anúncios."}
                </p>
                {status?.connected && (
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="mt-4 bg-primary text-black hover:bg-primary/90 font-semibold"
                  >
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                    Sincronizar Anúncios
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {listings.map((listing) => {
                  const statusInfo = getStatusInfo(listing.status);
                  return (
                    <div
                      key={listing.id}
                      className="bg-[#0d0d0d] border border-white/5 rounded-lg p-4 space-y-3 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                          {listing.title ?? "Sem título"}
                        </p>
                        <Badge className={`text-xs border shrink-0 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-primary">
                            {listing.price ? `R$ ${listing.price}` : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {listing.availableQuantity ?? 0} un.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedListing(listing)}
                          className="h-7 px-2 border-white/10 text-muted-foreground hover:text-white text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1.5" />
                          Detalhes
                        </Button>
                        {listing.permalink && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(listing.permalink!, "_blank")}
                            className="h-7 px-2 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 text-xs"
                          >
                            <ExternalLink className="w-3 h-3 mr-1.5" />
                            Ver no ML
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCreateCampaign(listing)}
                          className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
                        >
                          <ClipboardList className="w-3 h-3 mr-1.5" />
                          Campanha
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTrash(listing)}
                          disabled={trashingId === listing.id}
                          className="h-7 px-2 text-muted-foreground hover:text-red-400 text-xs ml-auto"
                        >
                          {trashingId === listing.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        <div className="mt-4">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Logs de Eventos
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showLogs && (
            <Card className="bg-[#111111] border-white/[0.06] mt-3">
              <CardContent className="p-4">
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">Nenhum evento registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {events.slice(0, 10).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 py-1.5 border-b border-white/5 last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-white">{ev.topic ?? "—"}</p>
                          {ev.resource && <p className="text-xs text-muted-foreground">{ev.resource}</p>}
                        </div>
                        {ev.userId && (
                          <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">UID: {ev.userId}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>
    </div>
  );
}
