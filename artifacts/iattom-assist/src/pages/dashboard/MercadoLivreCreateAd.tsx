import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Megaphone, Info, X, Package,
  Tag, ClipboardList, Loader2, CheckCircle2,
  ExternalLink, AlertCircle, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdProjectCtx {
  projectId: string;
  projectTitle: string;
  projectType: string;
  suggestedPrice: string;
  platform: string;
}

interface CategorySuggestion {
  category_id: string;
  category_name: string;
  domain_id: string | null;
  domain_name: string | null;
}

interface PublishResult {
  id: string;
  permalink: string;
}

type ModalVariant = "info" | "error" | "success";

// ─── Error resolver ───────────────────────────────────────────────────────────

function resolveErrorMessage(status: number, serverMsg: string): string {
  if (status === 401) {
    return "Token expirado. Reconecte sua conta Mercado Livre antes de publicar.";
  }
  if (status === 403) {
    return "Sem permissao. Verifique os escopos do app no painel do Mercado Livre.";
  }
  if (status === 503) {
    return "Conta Mercado Livre nao conectada. Reconecte sua conta antes de publicar.";
  }
  const msg = serverMsg.toLowerCase();
  if (msg.includes("category") || msg.includes("categoria") || msg.includes("invalid_category")) {
    return `Categoria invalida. Ajuste a categoria e tente novamente. Detalhe: ${serverMsg}`;
  }
  if (msg.includes("attribute") || msg.includes("atributo") || msg.includes("required")) {
    return `O Mercado Livre exige atributos adicionais para esta categoria. Tente uma categoria mais ampla. Detalhe: ${serverMsg}`;
  }
  if (msg.includes("price") || msg.includes("preco") || msg.includes("valor")) {
    return `Preco invalido. Verifique o valor informado e tente novamente. Detalhe: ${serverMsg}`;
  }
  return serverMsg || "Erro desconhecido ao publicar. Tente novamente.";
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function FeedbackModal({
  title,
  description,
  variant,
  result,
  onClose,
}: {
  title: string;
  description: string;
  variant: ModalVariant;
  result?: PublishResult;
  onClose: () => void;
}) {
  const iconBg =
    variant === "success" ? "bg-green-500/10"
    : variant === "error" ? "bg-red-500/10"
    : "bg-primary/10";
  const iconColor =
    variant === "success" ? "text-green-400"
    : variant === "error" ? "text-red-400"
    : "text-primary";
  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : Info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

        {result?.permalink && (
          <a
            href={result.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir anuncio
          </a>
        )}

        <Button
          onClick={onClose}
          className="w-full bg-primary text-black hover:bg-primary/90 font-semibold"
        >
          {result ? "Fechar" : "Entendido"}
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MercadoLivreCreateAd() {
  const [ctx, setCtx] = useState<AdProjectCtx | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    variant: ModalVariant;
    result?: PublishResult;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaNome, setCategoriaNome] = useState("");
  const [condicao, setCondicao] = useState<"new" | "used">("new");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [descricao, setDescricao] = useState("");

  // Category suggestion state
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Read sessionStorage on mount ──────────────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem("ad_project_context");
    if (!raw) { window.location.href = `${BASE}/dashboard/mercado-livre`; return; }
    try {
      const parsed = JSON.parse(raw) as AdProjectCtx;
      if (parsed.platform !== "mercado_livre") {
        window.location.href = `${BASE}/dashboard/mercado-livre`;
        return;
      }
      setCtx(parsed);
      setTitulo(parsed.projectTitle ?? "");
      setPreco(parsed.suggestedPrice ?? "");
      sessionStorage.removeItem("ad_project_context");
    } catch {
      window.location.href = `${BASE}/dashboard/mercado-livre`;
    }
  }, []);

  // ── Category suggest — debounced on title ─────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = titulo.trim();
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `${BASE}/api/me/ml/category-suggest?q=${encodeURIComponent(q)}`,
          { credentials: "include" },
        );
        if (!res.ok) { setSuggestions([]); return; }
        const data = await res.json() as { suggestions?: CategorySuggestion[] };
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 700);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titulo]);

  const selectCategory = (s: CategorySuggestion) => {
    setCategoriaId(s.category_id);
    setCategoriaNome(s.category_name);
    setShowSuggestions(false);
  };

  const clearCategory = () => { setCategoriaId(""); setCategoriaNome(""); };

  // ── Publish ───────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!titulo.trim()) {
      setModal({ title: "Campo obrigatorio", description: "Informe o titulo do anuncio antes de publicar.", variant: "error" });
      return;
    }
    if (!preco || Number(preco) <= 0) {
      setModal({ title: "Campo obrigatorio", description: "Informe um preco valido antes de publicar.", variant: "error" });
      return;
    }

    setPublishing(true);
    try {
      // 1. Verify user connection
      const statusRes = await fetch(`${BASE}/api/me/ml/status`, { credentials: "include" });
      const statusData = await statusRes.json() as { connected?: boolean };
      if (!statusRes.ok || !statusData.connected) {
        setModal({
          title: "Conta nao conectada",
          description: "Reconecte sua conta Mercado Livre antes de publicar. Va em Mercado Livre > Conectar conta.",
          variant: "error",
        });
        return;
      }

      // 2. Fetch valid listing types and pick the best one
      const ltUrl = `${BASE}/api/me/ml/listing-types${categoriaId ? `?category_id=${encodeURIComponent(categoriaId)}` : ""}`;
      const ltRes  = await fetch(ltUrl, { credentials: "include" });
      const ltData = await ltRes.json() as { ok?: boolean; listing_type_id?: string | null; error?: string };

      if (!ltRes.ok) {
        setModal({
          title: "Erro ao consultar tipos de anuncio",
          description: ltData.error ?? "Nao foi possivel obter os tipos de anuncio validos para esta categoria.",
          variant: "error",
        });
        return;
      }

      const listingTypeId = ltData.listing_type_id;
      if (!listingTypeId) {
        setModal({
          title: "Categoria sem tipo de anuncio",
          description: "Nao foram encontrados tipos de anuncio validos para esta categoria. Tente selecionar uma categoria diferente.",
          variant: "error",
        });
        return;
      }

      // 3. Build payload
      const payload: Record<string, unknown> = {
        title:              titulo.trim(),
        price:              Number(preco),
        available_quantity: Math.max(1, parseInt(quantidade, 10) || 1),
        condition:          condicao,
        listing_type_id:    listingTypeId,
      };
      if (categoriaId) payload["category_id"] = categoriaId;
      if (descricao.trim()) payload["description"] = descricao.trim();

      // 4. Call backend
      const res = await fetch(`${BASE}/api/me/ml/create-listing`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify(payload),
      });

      const data = await res.json() as {
        ok?: boolean;
        item?: { id?: string; permalink?: string };
        error?: string;
      };

      if (!res.ok || !data.ok) {
        const msg = resolveErrorMessage(res.status, data.error ?? "");
        setModal({ title: "Erro ao publicar", description: msg, variant: "error" });
        return;
      }

      // 4. Success
      const permalink = data.item?.permalink ?? "";
      const itemId    = data.item?.id ?? "";
      setModal({
        title:       "Anuncio criado com sucesso",
        description: `Seu anuncio foi publicado no Mercado Livre.${itemId ? ` ID: ${itemId}` : ""}`,
        variant:     "success",
        result:      permalink ? { id: itemId, permalink } : undefined,
      });
    } catch {
      setModal({
        title:       "Erro de conexao",
        description: "Nao foi possivel se comunicar com o servidor. Verifique sua conexao e tente novamente.",
        variant:     "error",
      });
    } finally {
      setPublishing(false);
    }
  };

  if (!ctx) return null;

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-8">
      {modal && (
        <FeedbackModal
          title={modal.title}
          description={modal.description}
          variant={modal.variant}
          result={modal.result}
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
        <div>
          <button
            onClick={() => { window.location.href = `${BASE}/dashboard/mercado-livre`; }}
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

            {/* Categoria — auto-suggest from API */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <ClipboardList className="w-3 h-3" />
                Categoria
                {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin ml-1 text-zinc-600" />}
              </label>

              {categoriaId ? (
                /* Selected category pill */
                <div className="flex items-center justify-between bg-[#0a0a0a] border border-primary/30 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white">{categoriaNome}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{categoriaId}</p>
                  </div>
                  <button
                    onClick={clearCategory}
                    className="text-zinc-500 hover:text-white transition-colors ml-3 shrink-0"
                    title="Remover categoria"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Suggestion dropdown */
                <div className="relative">
                  <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/[0.10] rounded-lg px-3">
                    <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <p className="py-2.5 text-sm text-zinc-600 select-none">
                      {titulo.trim().length >= 3
                        ? "Selecione uma categoria abaixo"
                        : "Sugestoes aparecem automaticamente com o titulo"}
                    </p>
                  </div>

                  {showSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                      {suggestions.map((s) => (
                        <button
                          key={s.category_id}
                          onClick={() => selectCategory(s)}
                          className="w-full text-left px-4 py-3 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04] last:border-0"
                        >
                          <p className="text-sm text-white">{s.category_name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{s.category_id}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {titulo.trim().length >= 3 && !loadingSuggestions && !showSuggestions && suggestions.length === 0 && (
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      Sem sugestoes para este titulo. O Mercado Livre usara categoria padrao.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Condição — toggle buttons */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <CheckCircle2 className="w-3 h-3" />
                Condicao
              </label>
              <div className="flex gap-2">
                {(["new", "used"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCondicao(v)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      condicao === v
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-[#0a0a0a] border-white/[0.10] text-zinc-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {v === "new" ? "Novo" : "Usado"}
                  </button>
                ))}
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
                  Publicando...
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
