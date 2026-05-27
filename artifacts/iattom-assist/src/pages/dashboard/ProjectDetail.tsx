import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useParams, useLocation } from "wouter";
import { loadProjectAssets, saveProjectAssets, deleteProjectAssets } from "@/lib/assetStorage";
import { useSavedItems } from "@/hooks/useSavedItems";
import {
  ArrowLeft, Trash2, Loader2, Copy, Check, ChevronDown, ChevronUp,
  FileText, Megaphone, Sparkles, Video, Search, ImageOff, Download, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { moveToTrash } from "@/lib/trashStorage";
import type {
  CampaignResult, ContentResult, CreativeIdeasResult,
  VideoScriptResult, FindProductsResult, ValidationResult,
} from "@/types/ai";

/* ─── Parsed data shape ─────────────────────────────────────── */
interface ParsedData {
  briefing: Record<string, unknown>;
  result: unknown;
  creatives?: CreativeIdeasResult | null;
}

/* ─── Storage helpers ───────────────────────────────────────── */
interface SavedItem {
  id: string;
  title: string;
  type: string;
  platform?: string;
  content: string;
  data?: string;
  createdAt: string;
}

function readStorage(): SavedItem[] {
  try {
    const raw = localStorage.getItem("iattom_saved_items_v1");
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch { return []; }
}

function writeStorage(items: SavedItem[]) {
  try { localStorage.setItem("iattom_saved_items_v1", JSON.stringify(items)); } catch {}
}

/* ─── Type config ───────────────────────────────────────────── */
const typeConfig: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  campaign:          { label: "Campanha",   icon: Megaphone, badge: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  content:           { label: "Conteúdo",   icon: FileText,  badge: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  creative:          { label: "Criativo",   icon: Sparkles,  badge: "bg-purple-400/10 text-purple-400 border-purple-400/20" },
  video_script:      { label: "Script",     icon: Video,     badge: "bg-rose-400/10 text-rose-400 border-rose-400/20" },
  product_discovery: { label: "Produtos",   icon: Search,    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  product_validation:{ label: "Validação",  icon: Search,    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
};

const platformLabels: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", shopee: "Shopee",
  mercado_livre: "Mercado Livre", tiktok: "TikTok",
  instagram: "Instagram", facebook: "Facebook",
};

const AD_PLATFORMS = [
  { id: "shopee",        label: "Shopee" },
  { id: "mercado_livre", label: "Mercado Livre" },
  { id: "hotmart",       label: "Hotmart" },
  { id: "kiwify",        label: "Kiwify" },
  { id: "tiktok",        label: "TikTok" },
  { id: "facebook",      label: "Facebook" },
  { id: "instagram",     label: "Instagram" },
] as const;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

/* ─── TextBlock ─────────────────────────────────────────────── */
function TextBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  if (!value?.trim()) return null;
  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast({ description: `"${label}" copiado.` });
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div className="group rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-primary transition-colors shrink-0"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

/* ─── SectionTitle ──────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{children}</p>
      <div className="flex-1 h-px bg-white/[0.05]" />
    </div>
  );
}

/* ─── Written content by type ───────────────────────────────── */
function CampaignContent({ result, creatives }: { result: CampaignResult; creatives?: CreativeIdeasResult | null }) {
  const copy = result.copy as Record<string, string> | undefined;
  return (
    <div className="space-y-3">
      <TextBlock label="Título da Campanha" value={result.headline} />
      <TextBlock label="Subtítulo" value={result.subheadline} />
      <TextBlock label="CTA" value={result.cta} />
      <TextBlock label="Público-alvo" value={result.audience} />
      {result.channels?.length ? <TextBlock label="Canais" value={result.channels.join(", ")} /> : null}
      <TextBlock label="Orçamento" value={result.budget} />
      <TextBlock label="Ângulo Único" value={result.uniqueAngle} />
      {result.keyMessages?.length ? <TextBlock label="Mensagens-chave" value={result.keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")} /> : null}
      {copy?.facebook  ? <TextBlock label="Copy Facebook"  value={copy.facebook}  /> : null}
      {copy?.instagram ? <TextBlock label="Copy Instagram" value={copy.instagram} /> : null}
      {copy?.google    ? <TextBlock label="Copy Google"    value={copy.google}    /> : null}
      {copy?.email     ? <TextBlock label="Copy Email"     value={copy.email}     /> : null}
      {copy?.tiktok    ? <TextBlock label="Copy TikTok"    value={copy.tiktok}    /> : null}
      <TextBlock label="Cronograma de Lançamento" value={result.launchTimeline} />
      <TextBlock label="Tratamento de Objeções" value={result.objectionHandling} />
      {creatives?.concepts?.length ? (
        <div className="mt-6 space-y-3">
          <SectionTitle>Criativos da Campanha</SectionTitle>
          {creatives.overarchingTheme ? <TextBlock label="Tema Central" value={creatives.overarchingTheme} /> : null}
          {creatives.concepts.map((c, i) => (
            <div key={c.id ?? i} className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4 space-y-3">
              <p className="text-xs font-semibold text-zinc-400">Criativo {i + 1} — {c.label}</p>
              <TextBlock label="Hook" value={c.copyHook} />
              <TextBlock label="Copy" value={c.bodyText} />
              <TextBlock label="CTA" value={c.cta} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContentContent({ result }: { result: ContentResult }) {
  return (
    <div className="space-y-3">
      <TextBlock label="Conteúdo para Blog" value={result.blog} />
      <TextBlock label="Post Social" value={result.social} />
      <TextBlock label="Email" value={result.email} />
      <TextBlock label="Thread Twitter" value={result.tweetThread} />
      <TextBlock label="SMS" value={result.smsText} />
      <TextBlock label="Título SEO" value={result.seoTitle} />
      <TextBlock label="Meta Descrição" value={result.seoDescription} />
    </div>
  );
}

function CreativeContent({ result }: { result: CreativeIdeasResult }) {
  return (
    <div className="space-y-3">
      <TextBlock label="Tema Central" value={result.overarchingTheme} />
      <TextBlock label="Tom da Marca" value={result.brandVoiceNotes} />
      {result.concepts?.map((c, i) => (
        <div key={c.id ?? i} className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-400">Criativo {i + 1} — {c.label}</p>
          <TextBlock label="Hook" value={c.copyHook} />
          <TextBlock label="Copy" value={c.bodyText} />
          <TextBlock label="CTA" value={c.cta} />
          <TextBlock label="Gatilho Emocional" value={c.emotionalTrigger} />
          <TextBlock label="Melhor Plataforma" value={c.bestPlatform} />
        </div>
      ))}
    </div>
  );
}

function VideoScriptContent({ result }: { result: VideoScriptResult }) {
  return (
    <div className="space-y-3">
      <TextBlock label="Título" value={result.title} />
      <TextBlock label="Duração" value={result.duration} />
      <TextBlock label="Estilo de Narração" value={result.voiceoverStyle} />
      <TextBlock label="Mood Musical" value={result.musicMood} />
      <TextBlock label="Ritmo de Edição" value={result.editingPace} />
      <TextBlock label="Estilo das Legendas" value={result.captionStyle} />
      <TextBlock label="Gatilho Viral" value={result.viralTrigger} />
      {result.hooks?.length ? <TextBlock label="Hooks de Abertura" value={result.hooks.join("\n---\n")} /> : null}
      {result.scenes?.length ? (
        <div className="space-y-3">
          <SectionTitle>Cenas do Roteiro</SectionTitle>
          {result.scenes.map((scene, i) => (
            <TextBlock
              key={i}
              label={`Cena ${i + 1}${scene.time ? ` — ${scene.time}` : ""}`}
              value={[
                scene.visual && `Visual: ${scene.visual}`,
                scene.script && `Roteiro: ${scene.script}`,
                scene.emotion && `Emoção: ${scene.emotion}`,
                scene.direction && `Direção: ${scene.direction}`,
              ].filter(Boolean).join("\n")}
            />
          ))}
        </div>
      ) : null}
      {result.distributionTips?.length ? <TextBlock label="Dicas de Distribuição" value={result.distributionTips.join("\n")} /> : null}
    </div>
  );
}

function FindProductsContent({ result }: { result: FindProductsResult }) {
  return (
    <div className="space-y-3">
      <TextBlock label="Insight de Mercado" value={result.marketInsight} />
      <TextBlock label="Melhor Escolha" value={result.topPick} />
      {result.products?.map((p, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0d0d0d] p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-400">Produto {i + 1} — {p.name}</p>
          <TextBlock label="Categoria" value={p.category} />
          <TextBlock label="Demanda" value={p.demand} />
          <TextBlock label="Margem" value={p.margin} />
          <TextBlock label="Tendência" value={p.trend} />
          <TextBlock label="Por que agora?" value={p.whyNow} />
          <TextBlock label="Público-alvo" value={p.targetAudience} />
          {p.keySellingPoints?.length ? <TextBlock label="Pontos de Venda" value={p.keySellingPoints.join("\n")} /> : null}
          <TextBlock label="Concorrência" value={p.competition} />
          <TextBlock label="Receita Mensal Estimada" value={p.estimatedMonthlyRevenue} />
        </div>
      ))}
    </div>
  );
}

function ValidationContent({ result }: { result: ValidationResult }) {
  return (
    <div className="space-y-3">
      <TextBlock label="Veredicto" value={result.verdict} />
      {result.score !== undefined ? <TextBlock label="Score de Viabilidade" value={String(result.score)} /> : null}
      <TextBlock label="Tamanho do Mercado" value={result.marketSize} />
      <TextBlock label="Concorrência" value={result.competition} />
      <TextBlock label="Tendência de Demanda" value={result.demandTrend} />
      <TextBlock label="Recomendação" value={result.recommendation} />
      <TextBlock label="Estratégia de Lançamento" value={result.launchStrategy} />
      <TextBlock label="Insight de Preço" value={result.pricingInsight} />
      {result.strengths?.length ? <TextBlock label="Pontos Fortes" value={result.strengths.join("\n")} /> : null}
      {result.risks?.length ? <TextBlock label="Riscos" value={result.risks.join("\n")} /> : null}
      {result.opportunities?.length ? <TextBlock label="Oportunidades" value={result.opportunities.join("\n")} /> : null}
    </div>
  );
}

/* ─── Image section ─────────────────────────────────────────── */
interface ImageEntry { label: string; base64: string; format: string }

function extractImages(type: string, parsed: { result: unknown; creatives?: CreativeIdeasResult | null }): ImageEntry[] {
  const images: ImageEntry[] = [];
  const tryConceptImages = (concepts: CreativeIdeasResult["concepts"] | undefined, prefix: string) => {
    concepts?.forEach((c, i) => {
      if (c.imageBase64) {
        images.push({ label: `${prefix} ${i + 1} — ${c.label}`, base64: c.imageBase64, format: c.format ?? "PNG" });
      }
    });
  };
  if (type === "campaign" && parsed.creatives) {
    tryConceptImages(parsed.creatives.concepts, "Criativo");
  } else if (type === "creative") {
    tryConceptImages((parsed.result as CreativeIdeasResult)?.concepts, "Criativo");
  }
  return images;
}

function ImagesSection({ images, onPreview }: { images: ImageEntry[]; onPreview: (img: ImageEntry, idx: number) => void }) {
  const handleDownload = (img: ImageEntry, idx: number) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.base64}`;
    a.download = `criativo-${idx + 1}.png`;
    a.click();
  };
  return (
    <div>
      <SectionTitle>Imagens do Projeto</SectionTitle>
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-white/[0.05] bg-[#0a0a0a] text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <ImageOff className="w-5 h-5 text-zinc-700" />
          </div>
          <p className="text-xs text-zinc-500 max-w-[280px] leading-relaxed">
            As imagens originais não estão armazenadas neste projeto. Gere ou salve novamente para manter os arquivos visuais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((img, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden group/img">
              <button
                onClick={() => onPreview(img, i)}
                className="block w-full relative"
                title="Clique para ampliar"
              >
                <img
                  src={`data:image/png;base64,${img.base64}`}
                  alt={img.label}
                  className="w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                  <span className="text-white text-xs font-medium opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 bg-black/60 px-3 py-1.5 rounded-full">
                    Ampliar
                  </span>
                </div>
              </button>
              <div className="p-3 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-400 truncate">{img.label}</p>
                <button
                  onClick={() => handleDownload(img, i)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-primary transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tech details (collapsible) ────────────────────────────── */
function TechDetails({ briefing, type, result }: { briefing: Record<string, unknown>; type: string; result: unknown }) {
  const [open, setOpen] = useState(false);
  const briefingEntries = Object.entries(briefing).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const techLines: string[] = [];
  if (type === "creative" || type === "campaign") {
    const concepts = type === "creative"
      ? (result as CreativeIdeasResult)?.concepts
      : undefined;
    concepts?.forEach((c, i) => {
    });
  }
  if (briefingEntries.length === 0 && techLines.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0a0a0a] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Detalhes técnicos</p>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/[0.05]">
          {briefingEntries.length > 0 && (
            <div className="pt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Briefing original</p>
              {briefingEntries.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-zinc-600 shrink-0 capitalize">{k}:</span>
                  <span className="text-zinc-400">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {techLines.length > 0 && (
            <div className="pt-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Metadados</p>
              {techLines.map((line, i) => <p key={i} className="text-xs text-zinc-500">{line}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */
export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getItems, getItemAssets } = useSavedItems();
  const [item, setItem] = useState<SavedItem | null | "not_found">(null);
  const [deletingId, setDeletingId] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [idbImages, setIdbImages] = useState<ImageEntry[]>([]);
  const [previewImage, setPreviewImage] = useState<{ img: ImageEntry; idx: number } | null>(null);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adPhase, setAdPhase] = useState<"pick" | "prepare">("pick");
  const [adPlatform, setAdPlatform] = useState<string | null>(null);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);

  useEffect(() => {
    if (!id) { setItem("not_found"); return; }

    async function loadItem() {
      // 1. Try localStorage first (fast path)
      const items = readStorage();
      const found = items.find(i => i.id === id);
      const resolved = found ?? await (async () => {
        // 2. Fallback: fetch from API (cross-device sync)
        try {
          const apiItems = await getItems();
          const apiFound = apiItems.find(i => i.id === id);
          if (apiFound) {
            // Cache in localStorage for future visits (text only — no images)
            try {
              writeStorage([...readStorage().filter(i => i.id !== id), apiFound as SavedItem]);
            } catch { /* noop */ }
          }
          return apiFound as SavedItem | undefined;
        } catch { return undefined; }
      })();

      setItem(resolved ?? "not_found");
      if (!resolved) return;

      // 3. Load images: IndexedDB first (local cache), then API fallback (cross-device)
      try {
        const idbAssets = await loadProjectAssets(id);
        if (idbAssets.length > 0) {
          setIdbImages(idbAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
          return;
        }
      } catch { /* IndexedDB unavailable */ }

      // 4. No local images — try API assets (persisted on save device)
      try {
        const apiAssets = await getItemAssets(id);
        if (apiAssets.length > 0) {
          setIdbImages(apiAssets.map(a => ({ label: a.label, base64: a.base64, format: a.format })));
          // Populate IndexedDB as cache for offline use
          void saveProjectAssets(id, apiAssets).catch(() => {});
        }
      } catch { /* API unavailable */ }
    }

    void loadItem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = useCallback(() => {
    setConfirmTrashOpen(true);
  }, []);

  const handleConfirmTrash = useCallback(() => {
    if (!item || item === "not_found") return;
    setDeletingId(true);
    const saved = item as SavedItem;
    moveToTrash(saved);
    setConfirmTrashOpen(false);
    setTimeout(() => {
      toast({ description: "Projeto enviado para a lixeira." });
      navigate("/dashboard/projects");
    }, 200);
  }, [item, navigate, toast]);

  const handleCopyAll = useCallback(() => {
    if (!item || item === "not_found") return;
    const saved = item as SavedItem;
    void navigator.clipboard.writeText(saved.content).then(() => {
      setAllCopied(true);
      toast({ description: "Todo o conteúdo copiado." });
      setTimeout(() => setAllCopied(false), 2000);
    });
  }, [item, toast]);

  if (item === null) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
      </div>
    );
  }

  if (item === "not_found") {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate("/dashboard/projects")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para Projetos Salvos
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-semibold text-zinc-400 mb-2">Projeto não encontrado</p>
          <p className="text-sm text-zinc-600">O item pode ter sido excluído ou o link está incorreto.</p>
        </div>
      </div>
    );
  }

  const cfg = typeConfig[item.type] ?? typeConfig.campaign;
  const Icon = cfg.icon;

  let parsed: ParsedData | null = null;
  if (item.data) {
    try { parsed = JSON.parse(item.data) as ParsedData; } catch {}
  }

  const inlineImages = parsed ? extractImages(item.type, parsed) : [];
  const images = idbImages.length > 0 ? idbImages : inlineImages;

  const renderWrittenContent = () => {
    const p = parsed;
    if (!p) {
      return (
        <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-4">
          <p className="text-xs text-zinc-500 mb-3">Projeto antigo — dados estruturados indisponíveis.</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>
        </div>
      );
    }
    const r = p.result;
    switch (item.type) {
      case "campaign":        return <CampaignContent result={r as CampaignResult} creatives={p.creatives} />;
      case "content":         return <ContentContent result={r as ContentResult} />;
      case "creative":        return <CreativeContent result={r as CreativeIdeasResult} />;
      case "video_script":    return <VideoScriptContent result={r as VideoScriptResult} />;
      case "product_discovery": return <FindProductsContent result={r as FindProductsResult} />;
      case "product_validation": return <ValidationContent result={r as ValidationResult} />;
      default:
        return (
          <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] p-4">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.content}</p>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-8 max-w-3xl"
    >
      {/* Back nav */}
      <button
        onClick={() => navigate("/dashboard/projects")}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Projetos Salvos
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-[#111111] border border-white/[0.07] p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${cfg.badge}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">{item.title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>{cfg.label}</Badge>
                {item.platform && platformLabels[item.platform] && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/[0.04] text-zinc-500 border-white/[0.08]">
                    {platformLabels[item.platform]}
                  </Badge>
                )}
                <span className="text-xs text-zinc-600">{formatDate(item.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deletingId}
            title="Excluir projeto"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-400/[0.08] transition-colors shrink-0"
          >
            {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCopyAll}
            className="h-7 px-3 text-xs bg-white/[0.05] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.09] hover:text-white"
          >
            {allCopied ? <Check className="w-3 h-3 mr-1.5 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1.5" />}
            {allCopied ? "Copiado" : "Copiar tudo"}
          </Button>
          <Button
            size="sm"
            onClick={() => { setAdPhase("pick"); setAdPlatform(null); setAdModalOpen(true); }}
            className="h-7 px-3 text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30"
          >
            <Megaphone className="w-3 h-3 mr-1.5" />
            Criar anuncio
          </Button>
        </div>
      </div>

      {/* Written content */}
      <div>
        <SectionTitle>Conteúdo escrito</SectionTitle>
        {renderWrittenContent()}
      </div>

      {/* Images */}
      <ImagesSection images={images} onPreview={(img, idx) => setPreviewImage({ img, idx })} />

      {/* Tech details */}
      {(() => {
        const p = parsed;
        if (!p) return null;
        return (
          <TechDetails
            briefing={p.briefing ?? {}}
            type={item.type}
            result={p.result}
          />
        );
      })()}

      {/* ── Modal: image preview ─────────────────────────────── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="bg-[#080808] border-white/[0.08] text-white max-w-3xl p-0 overflow-hidden shadow-depth-lg">
          <div className="relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-zinc-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {previewImage && (
              <>
                <img
                  src={`data:image/png;base64,${previewImage.img.base64}`}
                  alt={previewImage.img.label}
                  className="w-full object-contain max-h-[80vh]"
                />
                <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-white/[0.06]">
                  <p className="text-sm text-zinc-300 truncate">{previewImage.img.label}</p>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = `data:image/png;base64,${previewImage.img.base64}`;
                      a.download = `criativo-${previewImage.idx + 1}.png`;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-primary transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: criar anuncio ─────────────────────────────── */}
      <Dialog open={adModalOpen} onOpenChange={(open) => { if (!open) { setAdModalOpen(false); setAdPhase("pick"); setAdPlatform(null); } }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-md shadow-depth-lg animate-scale-in">
          {adPhase === "pick" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  Criar anuncio — escolha a plataforma
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-zinc-500">Selecione onde deseja publicar este projeto como anuncio.</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {AD_PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setAdPlatform(p.id); setAdPhase("prepare"); }}
                    className="px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-primary/[0.06] hover:border-primary/20 text-sm text-zinc-300 hover:text-white transition-all duration-200 text-left font-medium"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  Publicacao assistida — {AD_PLATFORMS.find(p => p.id === adPlatform)?.label}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl bg-primary/[0.06] border border-primary/20 px-4 py-3 space-y-1">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Projeto selecionado</p>
                  <p className="text-sm font-medium text-zinc-200">{(item as SavedItem).title}</p>
                  <p className="text-xs text-zinc-500">{typeConfig[(item as SavedItem).type]?.label ?? ""}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 space-y-2">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Proxima etapa</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    A publicacao assistida no <span className="text-primary font-medium">{AD_PLATFORMS.find(p => p.id === adPlatform)?.label}</span> esta sendo preparada. Na proxima etapa, voce podera revisar o material, ajustar o formato para a plataforma e publicar diretamente.
                  </p>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">Nenhuma publicacao foi feita ainda. Tudo sera revisado antes de ir ao ar.</p>
              </div>
              <DialogFooter className="gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-zinc-400 hover:text-white"
                  onClick={() => setAdPhase("pick")}
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                  onClick={() => { setAdModalOpen(false); setAdPhase("pick"); setAdPlatform(null); toast({ description: "Publicacao assistida registrada. Disponivel na proxima etapa." }); }}
                >
                  Entendido
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: confirm trash ─────────────────────────────── */}
      <Dialog open={confirmTrashOpen} onOpenChange={(open) => { if (!open) setConfirmTrashOpen(false); }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.10] text-white max-w-sm shadow-depth-lg animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Enviar para lixeira?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400 leading-relaxed">
            O projeto sera movido para a lixeira e excluido definitivamente apos <span className="text-zinc-200 font-medium">48 horas</span>. Voce pode restaura-lo antes do prazo.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-zinc-400 hover:text-white"
              onClick={() => setConfirmTrashOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmTrash}
              disabled={deletingId}
              className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            >
              {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Enviar para lixeira
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
