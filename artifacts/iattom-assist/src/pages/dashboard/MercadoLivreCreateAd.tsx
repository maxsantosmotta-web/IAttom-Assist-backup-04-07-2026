import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Megaphone, Info, X, Package,
  Tag, ClipboardList, Loader2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdProjectCtx {
  projectId: string;
  projectTitle: string;
  projectType: string;
  suggestedPrice: string;
  platform: string;
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
        <Button
          onClick={onClose}
          className="w-full bg-primary text-black hover:bg-primary/90 font-semibold"
        >
          Entendido
        </Button>
      </motion.div>
    </div>
  );
}

const CATEGORIES = [
  "Eletrônicos e Tecnologia",
  "Moda e Acessórios",
  "Casa, Móveis e Decoração",
  "Esportes e Fitness",
  "Brinquedos e Hobbies",
  "Livros, Revistas e Comics",
  "Beleza e Cuidado Pessoal",
  "Automotivo",
  "Alimentos e Bebidas",
  "Serviços",
  "Outros",
];

export function MercadoLivreCreateAd() {
  const [, navigate] = useLocation();
  const [ctx, setCtx] = useState<AdProjectCtx | null>(null);
  const [modal, setModal] = useState<{ title: string; description: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [condicao, setCondicao] = useState("Novo");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("ad_project_context");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AdProjectCtx;
        if (parsed.platform === "mercado_livre") {
          setCtx(parsed);
          setTitulo(parsed.projectTitle ?? "");
          setPreco(parsed.suggestedPrice ?? "");
          sessionStorage.removeItem("ad_project_context");
        } else {
          navigate("/dashboard/mercado-livre");
        }
      } catch {
        navigate("/dashboard/mercado-livre");
      }
    } else {
      navigate("/dashboard/mercado-livre");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showInfo = (title: string, description: string) =>
    setModal({ title, description });

  const handlePublish = async () => {
    if (!titulo.trim()) {
      showInfo("Campo obrigatório", "Informe o título do anúncio antes de publicar.");
      return;
    }
    if (!preco || Number(preco) <= 0) {
      showInfo("Campo obrigatório", "Informe um preço válido antes de publicar.");
      return;
    }
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 900));
    setPublishing(false);
    showInfo(
      "Publicacao via API",
      "A publicacao direta via API do Mercado Livre estara disponivel na proxima versao. Seu anuncio foi preparado e pode ser publicado manualmente no painel do Mercado Livre.",
    );
  };

  if (!ctx) return null;

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-8">
      {modal && (
        <InformativeModal
          title={modal.title}
          description={modal.description}
          onClose={() => setModal(null)}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.href = `${BASE}/dashboard/mercado-livre`}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Mercado Livre
          </button>
        </div>

        <div>
          <h1 className="text-xl font-bold text-white">Criar Anuncio</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Preencha os dados do anuncio para publicacao no Mercado Livre</p>
        </div>

        {/* Project context card */}
        <Card className="bg-primary/[0.05] border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">Projeto base</p>
              <p className="text-sm font-medium text-white truncate">{ctx.projectTitle}</p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="bg-[#111111] border-white/[0.06]">
          <CardContent className="p-5 space-y-5">

            {/* Título */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <Tag className="w-3 h-3" />
                Titulo do anuncio
              </label>
              <input
                type="text"
                maxLength={60}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Produto premium — entrega em todo Brasil"
                className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
              />
              <p className="text-[10px] text-zinc-600 text-right">{titulo.length}/60 caracteres</p>
            </div>

            {/* Categoria + Condição */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  <ClipboardList className="w-3 h-3" />
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors appearance-none"
                >
                  <option value="" className="bg-[#111111]">Selecionar</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#111111]">{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  <CheckCircle2 className="w-3 h-3" />
                  Condicao
                </label>
                <select
                  value={condicao}
                  onChange={(e) => setCondicao(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40 transition-colors appearance-none"
                >
                  <option value="Novo" className="bg-[#111111]">Novo</option>
                  <option value="Usado" className="bg-[#111111]">Usado</option>
                </select>
              </div>
            </div>

            {/* Preço + Quantidade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Preco (BRL)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  <Package className="w-3 h-3" />
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="1"
                  className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Descricao do produto
              </label>
              <textarea
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o produto, diferenciais, especificacoes e condicoes de envio..."
                className="w-full bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-colors resize-none"
              />
            </div>

            {/* Publish button */}
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full bg-primary text-black hover:bg-primary/90 font-semibold h-10"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4 mr-2" />
                  Publicar Anuncio
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
