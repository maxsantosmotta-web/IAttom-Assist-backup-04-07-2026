import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Plus, Copy, Trash2, ExternalLink, Loader2,
  Link2, Tag, DollarSign, X, Info, AlertCircle, CheckCircle2,
  RefreshCw, Package, ClipboardList, Store, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const STORAGE_KEY = "iattom_shopee_affiliates_v1";

interface AffiliateProduct {
  id: string;
  name: string;
  link: string;
  price?: string;
  category?: string;
  imageUrl?: string;
  addedAt: string;
}

function parseShopeeUrl(url: string): Partial<AffiliateProduct> {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!host.includes("shopee")) throw new Error("not shopee");

    const parts = u.pathname.split("/").filter(Boolean);
    let name = "";
    let itemId = "";

    for (const part of parts) {
      if (part.match(/^i\.\d+\.\d+$/)) {
        itemId = part;
        break;
      }
      if (part.includes("-i.")) {
        const [namePart, idPart] = part.split("-i.");
        name = namePart.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        itemId = `i.${idPart}`;
        break;
      }
      if (!name && part.length > 3 && !/^\d+$/.test(part)) {
        name = part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    return {
      id: itemId || `shopee_${Date.now()}`,
      name: name || "Produto Shopee",
      link: url,
    };
  } catch {
    return {};
  }
}

function loadAffiliates(): AffiliateProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AffiliateProduct[]) : [];
  } catch {
    return [];
  }
}

function saveAffiliates(items: AffiliateProduct[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function InformativeModal({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
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
        <Button onClick={onClose} className="w-full bg-primary text-black hover:bg-primary/90 font-semibold">
          Entendido
        </Button>
      </motion.div>
    </div>
  );
}

function ManualAddModal({
  onAdd,
  onClose,
}: {
  onAdd: (product: AffiliateProduct) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", link: "", price: "", category: "" });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.link.trim()) {
      toast({ variant: "destructive", description: "Nome e link são obrigatórios." });
      return;
    }
    onAdd({
      id: `manual_${Date.now()}`,
      name: form.name,
      link: form.link,
      price: form.price || undefined,
      category: form.category || undefined,
      addedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Tênis Esportivo Masculino" className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Link de Afiliado</Label>
            <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://shopee.com.br/..." className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Preço (opcional)</Label>
              <Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="R$ 99,90" className="bg-[#0a0a0a] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria (opcional)</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
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

function AbaAfiliado() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [affiliates, setAffiliates] = useState<AffiliateProduct[]>(loadAffiliates);
  const [showManual, setShowManual] = useState(false);

  const syncAffiliatesToStorage = useCallback((items: AffiliateProduct[]) => {
    setAffiliates(items);
    saveAffiliates(items);
  }, []);

  const handleImport = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast({ variant: "destructive", description: "Cole um link de produto Shopee." });
      return;
    }
    if (!trimmed.includes("shopee")) {
      toast({ variant: "destructive", description: "O link deve ser de um produto Shopee." });
      return;
    }
    setImporting(true);
    await new Promise((r) => setTimeout(r, 600));
    const parsed = parseShopeeUrl(trimmed);
    if (!parsed.name) {
      setImporting(false);
      toast({ description: "Não foi possível extrair o nome automaticamente. Use o cadastro manual." });
      setShowManual(true);
      return;
    }
    const product: AffiliateProduct = {
      id: parsed.id ?? `shopee_${Date.now()}`,
      name: parsed.name,
      link: trimmed,
      addedAt: new Date().toISOString(),
    };
    const updated = [product, ...affiliates.filter((a) => a.id !== product.id)];
    syncAffiliatesToStorage(updated);
    setUrlInput("");
    setImporting(false);
    toast({ description: `Produto importado: "${product.name}"` });
  };

  const handleDelete = (id: string) => {
    const updated = affiliates.filter((a) => a.id !== id);
    syncAffiliatesToStorage(updated);
    toast({ description: "Produto removido." });
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ description: "Link de afiliado copiado." });
  };

  const handleCampaign = (product: AffiliateProduct) => {
    sessionStorage.setItem(
      "iattom_campaign_prefill",
      JSON.stringify({ product: product.name, channel: "shopee_afiliado" }),
    );
    navigate("/dashboard/create-campaign");
    toast({ description: "Dados do produto carregados na criação de campanha." });
  };

  const handleAddManual = (product: AffiliateProduct) => {
    const updated = [product, ...affiliates];
    syncAffiliatesToStorage(updated);
    toast({ description: `Produto salvo: "${product.name}"` });
  };

  return (
    <div className="space-y-5">
      {showManual && (
        <ManualAddModal onAdd={handleAddManual} onClose={() => setShowManual(false)} />
      )}

      <Card className="bg-[#111111] border-white/[0.06]">
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Importar Produto</p>
            <p className="text-sm text-white font-semibold">Cole o link de um produto Shopee Afiliado</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleImport(); }}
                placeholder="https://shopee.com.br/produto-i.12345.67890"
                className="bg-[#0a0a0a] border-white/10 text-white pl-9"
              />
            </div>
            <Button
              onClick={() => void handleImport()}
              disabled={importing}
              className="bg-primary text-black hover:bg-primary/90 font-semibold shrink-0"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Importar
            </Button>
          </div>
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-muted-foreground hover:text-white transition-colors"
          >
            + Cadastro manual (se a importação automática não funcionar)
          </button>
        </CardContent>
      </Card>

      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Produtos Salvos
            {affiliates.length > 0 && (
              <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{affiliates.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {affiliates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShoppingBag className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhum produto salvo</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Cole um link acima para importar seu primeiro produto afiliado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {affiliates.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[#0d0d0d] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-primary/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{product.name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {product.price && (
                        <span className="text-xs text-primary font-medium">{product.price}</span>
                      )}
                      {product.category && (
                        <Badge className="bg-white/5 text-muted-foreground border-white/10 text-[10px]">{product.category}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground/60">
                        {new Date(product.addedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(product.link)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(product.link, "_blank")}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCampaign(product)}
                      className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
                    >
                      <ClipboardList className="w-3 h-3 mr-1.5" />
                      Campanha
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(product.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

function AbaLoja() {
  const { toast } = useToast();
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showInfo = (title: string, description: string) => {
    setModal({ title, description });
  };

  const handleConnect = async () => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 800));
    setConnecting(false);
    showInfo(
      "Conectar Shopee Seller",
      "A integração com Shopee Seller Center requer credenciais de parceiro (Partner ID e Partner Key) configuradas pelo administrador. Esta função está preparada para a próxima etapa da plataforma.",
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 800));
    setSyncing(false);
    toast({ description: "Função preparada para próxima etapa — sincronização ativa após conexão da loja." });
  };

  return (
    <div className="space-y-5">
      {modal && (
        <InformativeModal title={modal.title} description={modal.description} onClose={() => setModal(null)} />
      )}

      {/* Status da Conexão */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Loja não conectada</p>
                <p className="text-xs text-muted-foreground">Configure as credenciais de parceiro para conectar</p>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-orange-500 hover:bg-orange-400 text-white font-semibold"
              size="sm"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
              Conectar Loja Shopee
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Produtos da Loja */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Produtos da Loja
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 px-2 border-white/10 text-muted-foreground hover:text-white text-xs"
            >
              {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
              Sincronizar Produtos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Store className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Loja não conectada</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
              Conecte sua conta Shopee Seller para sincronizar e gerenciar seus produtos aqui.
            </p>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="mt-4 bg-orange-500 hover:bg-orange-400 text-white font-semibold"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
              Conectar Loja
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pedidos */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-xs text-muted-foreground/60">Pedidos disponíveis após conexão da loja.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => showInfo("Pedidos Shopee", "O histórico de pedidos será sincronizado automaticamente após a conexão com o Shopee Seller Center. Função preparada para próxima etapa.")}
              className="mt-3 border-white/10 text-muted-foreground hover:text-white text-xs h-7"
            >
              Saber mais
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="bg-[#111111] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white">Logs de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground/60 text-center py-4">Nenhum evento registrado.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Shopee() {
  const [activeTab, setActiveTab] = useState<"afiliado" | "loja">("afiliado");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Shopee</h1>
            <p className="text-xs text-muted-foreground">Gerencie afiliados e sua loja Shopee</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#111111] border border-white/[0.06] rounded-lg w-fit mb-5">
          {([
            { id: "afiliado", label: "Shopee Afiliado", icon: Tag },
            { id: "loja", label: "Minha Loja", icon: Store },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === id
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "afiliado" ? <AbaAfiliado /> : <AbaLoja />}
      </motion.div>
    </div>
  );
}
