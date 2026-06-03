import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Plus, Copy, Trash2, ExternalLink, Loader2,
  Link2, Tag, X, Info, AlertCircle, CheckCircle2,
  Package, ClipboardList, Store, Search,
  Megaphone, BarChart2, WifiOff, LogOut, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AbaMinhaContaLoja ─────────────────────────────────────── */
function AbaMinhaContaLoja({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);

  const showInfo = (title: string, description: string) => setModal({ title, description });

  const handleAnalytics = () => {
    showInfo(
      "Análise Shopee",
      "As métricas de performance estarão disponíveis após a conexão da conta.",
    );
  };

  const handleCriarCampanha = () => {
    sessionStorage.setItem("campaign_platform_context", JSON.stringify({ platform: "shopee" }));
    window.location.href = `${BASE}/dashboard/create-campaign`;
  };

  const handleCriarConteudo = () => {
    sessionStorage.setItem("content_platform_context", JSON.stringify({ platform: "shopee" }));
    window.location.href = `${BASE}/dashboard/create-content`;
  };

  const handleCriarAnuncio = () => {
    window.open("https://seller.shopee.com.br/portal/product/add", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {modal && (
        <InformativeModal
          title={modal.title}
          description={modal.description}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Status Card ──────────────────────────────────────── */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {connected ? "Conta Shopee conectada" : "Conta Shopee não conectada"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {connected
                  ? "Sua conta está ativa e sincronizada."
                  : "Conecte sua conta para acessar produtos, campanhas e vendas."}
              </p>
            </div>
            {!connected && (
              <Button
                size="sm"
                variant="outline"
                onClick={onConnect}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 ml-auto shrink-0"
              >
                <Link2 className="w-3 h-3 mr-1.5" />
                Conectar
              </Button>
            )}
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
              Acompanhe suas campanhas da Shopee. Visualizações, alcance e conversões disponíveis após conexão.
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
                { icon: CheckCircle2, label: "Conexão",              value: connected ? "Ativa" : "Aguardando", ok: connected },
                { icon: Package,      label: "Produtos conectados",  value: "—",                                ok: false },
                { icon: BarChart2,    label: "Eventos recebidos",    value: "—",                                ok: false },
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
            {!connected && (
              <Button
                size="sm"
                variant="outline"
                onClick={onConnect}
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
                { icon: Package,    label: "Produtos",    value: "—" },
                { icon: TrendingUp, label: "Conversões",  value: "—" },
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
  const [activeTab, setActiveTab] = useState<"conta" | "afiliado">("conta");
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

        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Shopee</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gerencie produtos, campanhas e suas vendas na Shopee
              </p>
            </div>
          </div>

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
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Conta conectada
                  </Badge>
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
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Conexão Shopee aguardando ativação.</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                As funcionalidades de Minha Conta estarão disponíveis em breve. A aba Afiliado funciona normalmente.
              </p>
            </div>
          </div>
        )}

        {/* Banner: credenciais OK mas usuário não conectou */}
        {!loadingStatus && status?.platformConfigured && !status?.connected && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 mb-4">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-300">Conecte sua conta Shopee para acessar Minha Conta.</p>
              <p className="text-xs text-blue-400/70 mt-0.5">
                Clique em "Conectar Shopee" acima para iniciar a conexão. A aba Afiliado funciona sem conexão.
              </p>
            </div>
          </div>
        )}

        {/* ─── Tabs ───────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-[#111111] border border-white/[0.06] rounded-lg w-fit mb-5">
          {([
            { id: "conta",    label: "Minha Conta", icon: Store },
            { id: "afiliado", label: "Afiliado",    icon: Tag   },
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

      </motion.div>
    </div>
  );
}
