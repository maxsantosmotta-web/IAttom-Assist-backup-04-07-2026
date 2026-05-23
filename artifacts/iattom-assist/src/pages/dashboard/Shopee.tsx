import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Plus, Copy, Trash2, ExternalLink, Loader2,
  Link2, Tag, X, Info, AlertCircle, CheckCircle2,
  RefreshCw, Package, ClipboardList, Store, Search, Image,
  Video, Megaphone, Zap, BarChart2, WifiOff, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

/* ─── storage keys ──────────────────────────────────────────── */
const STORAGE_KEY = "iattom_shopee_affiliates_v1";

/* ─── types ─────────────────────────────────────────────────── */
interface AffiliateProduct {
  id: string;
  name: string;
  link: string;
  price?: string;
  category?: string;
  addedAt: string;
}

/* ─── helpers ───────────────────────────────────────────────── */
function parseShopeeUrl(url: string): Partial<AffiliateProduct> {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes("shopee")) throw new Error();
    const parts = u.pathname.split("/").filter(Boolean);
    let name = "", itemId = "";
    for (const part of parts) {
      if (part.match(/^i\.\d+\.\d+$/)) { itemId = part; break; }
      if (part.includes("-i.")) {
        const [namePart, idPart] = part.split("-i.");
        name   = namePart.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        itemId = `i.${idPart}`;
        break;
      }
      if (!name && part.length > 3 && !/^\d+$/.test(part))
        name = part.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    return { id: itemId || `shopee_${Date.now()}`, name: name || "Produto Shopee", link: url };
  } catch { return {}; }
}

function loadAffiliates(): AffiliateProduct[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveAffiliates(items: AffiliateProduct[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ─── InformativeModal ──────────────────────────────────────── */
function InformativeModal({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
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
        <Button onClick={onClose} className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">
          Entendido
        </Button>
      </motion.div>
    </div>
  );
}

/* ─── ManualAddModal ────────────────────────────────────────── */
function ManualAddModal({ onAdd, onClose }: { onAdd: (p: AffiliateProduct) => void; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", link: "", price: "", category: "" });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.link.trim()) {
      toast({ variant: "destructive", description: "Nome e link são obrigatórios." });
      return;
    }
    onAdd({ id: `manual_${Date.now()}`, name: form.name, link: form.link, price: form.price || undefined, category: form.category || undefined, addedAt: new Date().toISOString() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <p className="text-sm font-semibold text-white">Cadastro Manual</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Nome do Produto</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Tênis Esportivo Masculino" className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Link de Afiliado</Label>
            <Input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
              placeholder="https://shopee.com.br/..." className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Preço (opcional)</Label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="R$ 99,90" className="bg-[#0a0a0a] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria (opcional)</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Moda" className="bg-[#0a0a0a] border-white/10 text-white" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} className="flex-1 bg-primary text-black hover:bg-primary/90 font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Salvar Produto
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-muted-foreground hover:text-white">
            Cancelar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── AbaAfiliado ───────────────────────────────────────────── */
function AbaAfiliado() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [affiliates, setAffiliates] = useState<AffiliateProduct[]>(loadAffiliates);
  const [showManual, setShowManual] = useState(false);
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);

  const sync = useCallback((items: AffiliateProduct[]) => { setAffiliates(items); saveAffiliates(items); }, []);

  const handleImport = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { toast({ variant: "destructive", description: "Cole um link de produto Shopee." }); return; }
    if (!trimmed.includes("shopee")) { toast({ variant: "destructive", description: "O link deve ser de um produto Shopee." }); return; }
    setImporting(true);
    await new Promise(r => setTimeout(r, 600));
    const parsed = parseShopeeUrl(trimmed);
    if (!parsed.name) { setImporting(false); toast({ description: "Não foi possível extrair o nome automaticamente. Use o cadastro manual." }); setShowManual(true); return; }
    const product: AffiliateProduct = { id: parsed.id ?? `shopee_${Date.now()}`, name: parsed.name, link: trimmed, addedAt: new Date().toISOString() };
    sync([product, ...affiliates.filter(a => a.id !== product.id)]);
    setUrlInput("");
    setImporting(false);
    toast({ description: `Produto importado: "${product.name}"` });
  };

  const handleDelete  = (id: string)  => { sync(affiliates.filter(a => a.id !== id)); toast({ description: "Produto removido." }); };
  const handleCopy    = (link: string) => { navigator.clipboard.writeText(link); toast({ description: "Link de afiliado copiado." }); };
  const handleCampaign = (p: AffiliateProduct) => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ product: p.name, goal: "Vender na Shopee" }));
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados do produto carregados na criação de campanha." });
  };
  const handleImage  = (p: AffiliateProduct) => {
    sessionStorage.setItem("iattom_creative_prefill", JSON.stringify({ product: p.name, platform: "Shopee" }));
    navigate("/dashboard/creative-generator");
    toast({ description: "Produto carregado no gerador de imagens." });
  };
  const handleScript = (p: AffiliateProduct) => {
    sessionStorage.setItem("iattom_script_prefill", JSON.stringify({ product: p.name, platform: "Shopee" }));
    navigate("/dashboard/video-scripts");
    toast({ description: "Produto carregado no gerador de scripts." });
  };

  return (
    <div className="space-y-5">
      {showManual && <ManualAddModal onAdd={p => { sync([p, ...affiliates]); toast({ description: `Produto salvo: "${p.name}"` }); }} onClose={() => setShowManual(false)} />}
      {modal && <InformativeModal title={modal.title} description={modal.description} onClose={() => setModal(null)} />}

      {/* Importar Produto */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-0.5">Importar Produto</p>
            <p className="text-sm font-semibold text-white">Cole o link de um produto Shopee Afiliado</p>
            <p className="text-xs text-muted-foreground mt-0.5">O nome e os dados serão extraídos automaticamente do link.</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void handleImport(); }}
                placeholder="https://shopee.com.br/produto-i.12345.67890"
                className="bg-[#0a0a0a] border-white/10 text-white pl-9"
              />
            </div>
            <Button onClick={() => void handleImport()} disabled={importing} className="bg-orange-500 hover:bg-orange-400 text-white font-semibold shrink-0">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Importar
            </Button>
          </div>
          <button onClick={() => setShowManual(true)} className="text-xs text-muted-foreground hover:text-white transition-colors">
            + Cadastro manual (se a importação automática não funcionar)
          </button>
        </CardContent>
      </Card>

      {/* Produtos Salvos */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Produtos Salvos
            {affiliates.length > 0 && (
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/20 text-xs">{affiliates.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {affiliates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-orange-500/5 border border-orange-500/10 flex items-center justify-center mb-1">
                <ShoppingBag className="w-5 h-5 text-orange-400/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Nenhum produto salvo</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">Cole um link acima para importar seu primeiro produto afiliado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {affiliates.map(product => (
                <div key={product.id} className="p-4 rounded-xl bg-[#0d0d0d] border border-white/5 hover:border-orange-500/20 transition-colors space-y-3">
                  {/* product info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {product.price && <span className="text-xs text-orange-400 font-medium">{product.price}</span>}
                        {product.category && <Badge className="bg-white/5 text-muted-foreground border-white/10 text-[10px]">{product.category}</Badge>}
                        <span className="text-[10px] text-muted-foreground/50">{new Date(product.addedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(product.link)} className="h-7 w-7 p-0 text-muted-foreground hover:text-white" title="Copiar link">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open(product.link, "_blank")} className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-400" title="Abrir produto">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {/* action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
                    <Button size="sm" onClick={() => handleCampaign(product)} className="h-7 px-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-medium">
                      <Megaphone className="w-3 h-3 mr-1.5" /> Criar campanha
                    </Button>
                    <Button size="sm" onClick={() => handleImage(product)} className="h-7 px-3 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/8 border border-white/10 text-xs font-medium">
                      <Image className="w-3 h-3 mr-1.5" /> Gerar imagem
                    </Button>
                    <Button size="sm" onClick={() => handleScript(product)} className="h-7 px-3 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/8 border border-white/10 text-xs font-medium">
                      <Video className="w-3 h-3 mr-1.5" /> Gerar script
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AbaMinhaContaSection helper ───────────────────────────── */
function ContaSection({
  icon: Icon,
  title,
  color,
  emptyText,
  actions,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  emptyText: string;
  actions: { label: string; icon: React.ElementType; onClick: () => void; loading?: boolean }[];
}) {
  return (
    <Card className="bg-[#111111] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Icon className={`w-4 h-4 ${color}`} />
            {title}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {actions.map(a => (
              <Button key={a.label} size="sm" variant="outline" onClick={a.onClick} disabled={a.loading}
                className="h-7 px-3 border-white/10 text-muted-foreground hover:text-white text-xs gap-1.5">
                {a.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <a.icon className="w-3 h-3" />}
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-1">
          <Icon className="w-8 h-8 text-white/8 mb-1" />
          <p className="text-xs text-muted-foreground/60">{emptyText}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── AbaMinhaContaLoja ─────────────────────────────────────── */
function AbaMinhaContaLoja({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);

  const info = (title: string, description: string) => setModal({ title, description });

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    await new Promise(r => setTimeout(r, 800));
    setSyncingProducts(false);
    toast({ description: "Função preparada para próxima etapa — sincronização ativa após conexão real." });
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    await new Promise(r => setTimeout(r, 800));
    setSyncingOrders(false);
    toast({ description: "Função preparada para próxima etapa — pedidos sincronizados após conexão real." });
  };

  const handleCampaign = () => {
    sessionStorage.setItem("iattom_campaign_prefill", JSON.stringify({ goal: "Vender na Shopee" }));
    navigate("/dashboard/create-campaign");
    toast({ description: "Criação de campanha aberta com contexto Shopee." });
  };

  const handleAd = () => {
    info(
      "Criar Anúncio Shopee",
      "A criação de anúncios diretamente via API Shopee Seller Center está preparada para a próxima etapa da plataforma. Você será notificado assim que estiver disponível.",
    );
  };

  if (!connected) {
    return (
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-orange-500/5 border border-orange-500/15 flex items-center justify-center mb-1">
            <Store className="w-6 h-6 text-orange-400/30" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Conecte sua conta Shopee para sincronizar produtos, anúncios e pedidos.</p>
            <p className="text-xs text-muted-foreground/50">A aba Afiliado funciona normalmente sem conexão.</p>
          </div>
          <Button onClick={onConnect} className="bg-orange-500 hover:bg-orange-400 text-white font-semibold gap-2">
            <Link2 className="w-4 h-4" /> Conectar Shopee
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {modal && <InformativeModal title={modal.title} description={modal.description} onClose={() => setModal(null)} />}

      <ContaSection
        icon={Package} title="Produtos da Conta" color="text-orange-400"
        emptyText="Conecte sua conta Shopee para sincronizar seus produtos."
        actions={[
          { label: "Sincronizar produtos", icon: RefreshCw, onClick: () => void handleSyncProducts(), loading: syncingProducts },
        ]}
      />

      <ContaSection
        icon={Megaphone} title="Anúncios" color="text-yellow-400"
        emptyText="Seus anúncios Shopee aparecerão aqui após a conexão."
        actions={[
          { label: "Criar anúncio", icon: Plus, onClick: handleAd },
        ]}
      />

      <ContaSection
        icon={ClipboardList} title="Pedidos" color="text-blue-400"
        emptyText="Histórico de pedidos disponível após conexão da conta."
        actions={[
          { label: "Sincronizar pedidos", icon: RefreshCw, onClick: () => void handleSyncOrders(), loading: syncingOrders },
        ]}
      />

      <ContaSection
        icon={BarChart2} title="Campanhas" color="text-primary"
        emptyText="Crie campanhas para seus produtos e acompanhe os resultados aqui."
        actions={[
          { label: "Criar campanha Shopee", icon: Megaphone, onClick: handleCampaign },
        ]}
      />

      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            Automações
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px]">Em breve</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center gap-1">
            <Zap className="w-8 h-8 text-white/8 mb-1" />
            <p className="text-xs text-muted-foreground/60">Regras automáticas de precificação, estoque e campanhas em desenvolvimento.</p>
            <button
              onClick={() => info("Automações Shopee", "Automações de precificação dinâmica, alertas de estoque e disparo automático de campanhas estão em desenvolvimento. Esta área será ativada nas próximas versões da plataforma.")}
              className="mt-2 text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors"
            >
              Saber mais
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── types ─────────────────────────────────────────────────── */
interface ShopeeStatus {
  connected: boolean;
  platformConfigured: boolean;
  connectionId?: number;
  shopId?: string | null;
  platformUsername?: string | null;
  connectedAt?: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Shopee (root) ─────────────────────────────────────────── */
export function Shopee() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"afiliado" | "conta">("afiliado");
  const [status, setStatus] = useState<ShopeeStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/shopee/me/status`, { credentials: "include" });
      const data = await r.json() as ShopeeStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false, platformConfigured: false });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shopee_connected") === "1") {
      toast({ description: "Conta Shopee conectada com sucesso." });
      window.history.replaceState({}, "", window.location.pathname);
      void loadStatus();
    } else if (params.get("shopee_error")) {
      const errMsg = decodeURIComponent(params.get("shopee_error") ?? "Erro desconhecido");
      toast({ variant: "destructive", description: errMsg });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast, loadStatus]);

  const handleConnect = () => {
    window.location.href = `${BASE}/api/shopee/oauth/start`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`${BASE}/api/shopee/me/disconnect`, { method: "POST", credentials: "include" });
      toast({ description: "Conta Shopee desconectada." });
      setShowDisconnect(false);
      void loadStatus();
    } catch {
      toast({ variant: "destructive", description: "Falha ao desconectar. Tente novamente." });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Disconnect confirm modal */}
      {showDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Desconectar conta Shopee</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sua conexão com a Shopee será removida.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Button onClick={() => void handleDisconnect()} disabled={disconnecting}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold">
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar desconexão
              </Button>
              <Button variant="outline" onClick={() => setShowDisconnect(false)}
                className="w-full border-white/10 text-muted-foreground hover:text-white">
                Cancelar
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ─── Header premium ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Shopee</h1>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm leading-relaxed">
                Importe produtos, crie campanhas e organize suas vendas com Inteligência.
              </p>
            </div>
          </div>

          {/* Status / ação */}
          <div className="flex items-center gap-2 shrink-0">
            <AnimatePresence mode="wait">
              {loadingStatus ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Badge className="bg-white/5 text-muted-foreground border-white/10 gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </Badge>
                </motion.div>
              ) : status?.connected ? (
                <motion.div key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> Conta conectada
                    </Badge>
                    {status.shopId && (
                      <span className="text-[10px] text-muted-foreground/60">Shop ID: {status.shopId}</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowDisconnect(true)}
                    className="h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1 text-xs">
                    <LogOut className="w-3 h-3" /> Desconectar
                  </Button>
                </motion.div>
              ) : status?.platformConfigured ? (
                <motion.div key="not-connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1.5">
                    <WifiOff className="w-3 h-3" /> Não conectado
                  </Badge>
                  <Button size="sm" onClick={handleConnect}
                    className="h-7 px-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs gap-1.5">
                    <Link2 className="w-3 h-3" /> Conectar Shopee
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="unconfigured" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1.5">
                    <WifiOff className="w-3 h-3" /> Aguardando configuração
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Banner: plataforma sem credenciais */}
        {!loadingStatus && !status?.platformConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Conexão Shopee aguardando configuração das credenciais oficiais.</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                As funcionalidades de Minha Conta estarão disponíveis após a configuração pelo administrador. A aba Afiliado funciona normalmente.
              </p>
            </div>
          </div>
        )}

        {/* Banner: credenciais OK mas usuário não conectou */}
        {!loadingStatus && status?.platformConfigured && !status?.connected && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 mb-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-300">Conecte sua conta Shopee para acessar Minha Conta.</p>
              <p className="text-xs text-blue-400/70 mt-0.5">
                Clique em "Conectar Shopee" acima para autorizar o acesso via OAuth. A aba Afiliado funciona sem conexão.
              </p>
            </div>
          </div>
        )}

        {/* ─── Tabs ───────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-[#111111] border border-white/[0.06] rounded-lg w-fit mb-5">
          {([
            { id: "afiliado", label: "Afiliado", icon: Tag },
            { id: "conta",    label: "Minha Conta", icon: Store },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === id ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ─── Tab content ────────────────────────────────────── */}
        {activeTab === "afiliado"
          ? <AbaAfiliado />
          : <AbaMinhaContaLoja connected={status?.connected ?? false} onConnect={handleConnect} />
        }

        {/* Campanhas Salvas */}
        {(() => {
          try {
            const all = JSON.parse(localStorage.getItem("iattom_saved_items_v1") ?? "[]") as { id: string; title: string; platform?: string }[];
            const campaigns = all.filter(c => c.platform === "shopee");
            if (!campaigns.length) return null;
            return (
              <Card className="bg-[#111111] border-white/[0.06] mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    Campanhas Salvas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[168px] overflow-y-auto space-y-1.5 pr-1">
                    {campaigns.slice(0, 10).map(c => (
                      <div key={c.id} className="px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-white/5">
                        <p className="text-sm text-white truncate">{c.title}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          } catch { return null; }
        })()}
      </motion.div>
    </div>
  );
}
