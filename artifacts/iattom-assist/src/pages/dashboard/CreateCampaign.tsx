import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Loader2, Copy, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Zap, Save, ExternalLink,
  FileText, ShoppingCart, ShoppingBag, Flame, Sparkles,
  Users, Camera, Play, CheckCircle2, ChevronLeft,
} from "lucide-react";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { loadModuleState, saveModuleState, clearModuleState } from "@/hooks/useModulePersistence";
import { getEffectiveProductType, detectIncompatibility, INCOMPATIBILITY_MESSAGES, detectProductTypeMismatch, PRODUCT_TYPE_MISMATCH_MESSAGE } from "@/lib/productPlatformCompatibility";
import { useSavedItems } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import type { CampaignResult, CampaignPlatformField, CampaignCreativeBriefing } from "@/types/ai";

// ─── Plataformas oficiais ─────────────────────────────────────────────────────
interface PlatformDef {
  key: string;
  goal: string;
  name: string;
  category: string;
  description: string;
  focus: string;
  accent: string;
  icon: React.ReactNode;
  modes: Array<{ value: string; label: string; description: string }>;
}

const PLATFORMS: PlatformDef[] = [
  {
    key: "mercado_livre",
    goal: "Vender no Mercado Livre",
    name: "Mercado Livre",
    category: "Marketplace",
    description: "Venda de produtos físicos com SEO de busca interna.",
    focus: "Foco em Produto",
    accent: "#FFE600",
    icon: <ShoppingCart className="w-5 h-5" />,
    modes: [
      { value: "Conversão", label: "Conversão", description: "Otimizado para venda imediata" },
      { value: "Orgânico", label: "Orgânico", description: "Crescimento via busca natural" },
    ],
  },
  {
    key: "shopee",
    goal: "Vender na Shopee",
    name: "Shopee",
    category: "Marketplace",
    description: "Marketplace com foco em volume, preço e palavras-chave.",
    focus: "Foco em Produto",
    accent: "#EE4D2D",
    icon: <ShoppingBag className="w-5 h-5" />,
    modes: [
      { value: "Conversão", label: "Conversão", description: "Otimizado para venda imediata" },
      { value: "Orgânico", label: "Orgânico", description: "Crescimento via busca natural" },
    ],
  },
  {
    key: "hotmart",
    goal: "Vender na Hotmart",
    name: "Hotmart",
    category: "Produto Digital",
    description: "Página de vendas para cursos, ebooks e infoprodutos.",
    focus: "Foco em Oferta",
    accent: "#F04E23",
    icon: <Flame className="w-5 h-5" />,
    modes: [
      { value: "Conversão", label: "Conversão", description: "Oferta direta, venda imediata" },
      { value: "Premium", label: "Premium", description: "Alto valor percebido, ticket elevado" },
      { value: "Escala", label: "Escala", description: "Produto validado em expansão" },
    ],
  },
  {
    key: "kiwify",
    goal: "Vender na Kiwify",
    name: "Kiwify",
    category: "Produto Digital",
    description: "Checkout simplificado para venda de produtos digitais.",
    focus: "Foco em Oferta Simplificada",
    accent: "#7C3AED",
    icon: <Sparkles className="w-5 h-5" />,
    modes: [
      { value: "Conversão", label: "Conversão", description: "Oferta direta, venda imediata" },
      { value: "Premium", label: "Premium", description: "Alto valor percebido, ticket elevado" },
      { value: "Escala", label: "Escala", description: "Produto validado em expansão" },
    ],
  },
  {
    key: "facebook",
    goal: "Vender no Facebook",
    name: "Facebook",
    category: "Rede Social",
    description: "Anúncios e campanhas de conversão paga no feed.",
    focus: "Foco em Anúncio",
    accent: "#1877F2",
    icon: <Users className="w-5 h-5" />,
    modes: [
      { value: "Conversão", label: "Conversão", description: "Anúncio direto para venda" },
      { value: "Agressivo", label: "Agressivo", description: "Alta pressão, remarketing" },
      { value: "Escala", label: "Escala", description: "Expansão de campanha validada" },
      { value: "Premium", label: "Premium", description: "Posicionamento de alto valor" },
    ],
  },
  {
    key: "instagram",
    goal: "Vender no Instagram",
    name: "Instagram",
    category: "Rede Social",
    description: "Conteúdo orgânico e relacionamento com audiência.",
    focus: "Foco em Postagem",
    accent: "#E1306C",
    icon: <Camera className="w-5 h-5" />,
    modes: [
      { value: "Orgânico", label: "Orgânico", description: "Crescimento natural sem tráfego pago" },
      { value: "Viral", label: "Viral", description: "Compartilhamento, UGC, alcance" },
      { value: "Premium", label: "Premium", description: "Posicionamento de alto valor" },
    ],
  },
  {
    key: "tiktok",
    goal: "Vender no TikTok",
    name: "TikTok",
    category: "Vídeo Curto",
    description: "Vídeos virais para alcance orgânico e conversão.",
    focus: "Foco em Vídeo",
    accent: "#69C9D0",
    icon: <Play className="w-5 h-5" />,
    modes: [
      { value: "Viral", label: "Viral", description: "Conteúdo compartilhável, UGC" },
      { value: "Conversão", label: "Conversão", description: "Venda direta via vídeo" },
      { value: "UGC", label: "UGC", description: "User Generated Content autêntico" },
    ],
  },
];

function getPlatformByGoal(goal: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.goal === goal);
}

// ─── Briefing labels ──────────────────────────────────────────────────────────
const BRIEFING_LABELS: Record<string, string> = {
  produto: "Produto",
  plataforma: "Plataforma",
  tipo_produto: "Tipo de Produto",
  objetivo: "Objetivo",
  promessa: "Promessa de Valor",
  dor: "Dor Principal",
  beneficio: "Benefício Principal",
  tom: "Tom de Voz",
  cta: "CTA Principal",
  ideia_visual: "Ideia Visual",
  restricoes: "Restrições",
};

// ─── Publicação assistida — máx. 5 passos ────────────────────────────────────
interface PlatformGuide {
  name: string;
  url: string;
  steps: string[];
}

function getPlatformGuide(platform: string | undefined, fields: CampaignPlatformField[]): PlatformGuide | null {
  const get = (key: string) => fields.find((f) => f.key === key)?.value ?? "";
  const p = platform ?? "";

  switch (p) {
    case "mercado_livre":
      return {
        name: "Mercado Livre",
        url: "https://www.mercadolivre.com.br",
        steps: [
          "Acesse mercadolivre.com.br → Meus Anúncios → Criar anúncio",
          `Cole o Título gerado (campo obrigatório): "${get("titulo").slice(0, 60)}"`,
          "Selecione a Categoria Sugerida e preencha os atributos com as Características Técnicas",
          "Cole a Descrição Completa no campo de descrição do anúncio",
          "Revise preço, fotos e publique",
        ],
      };

    case "shopee":
      return {
        name: "Shopee",
        url: "https://seller.shopee.com.br",
        steps: [
          "Acesse seller.shopee.com.br → Meus Produtos → Adicionar produto",
          `Cole o Nome do Anúncio: "${get("nome_anuncio").slice(0, 80)}"`,
          "Selecione a Categoria Sugerida",
          "Cole a Descrição do Produto e adicione as Palavras-chave nas tags",
          "Configure variações, preço e publique",
        ],
      };

    case "hotmart":
      return {
        name: "Hotmart",
        url: "https://app.hotmart.com",
        steps: [
          "Acesse app.hotmart.com → Meus Produtos → Página de Vendas",
          `Cole a Headline: "${get("headline").slice(0, 80)}"`,
          "Cole a Descrição Completa e os Benefícios no corpo da página",
          "Configure Bônus, Garantia e o botão de compra com o CTA gerado",
          "Revise e publique a página de vendas",
        ],
      };

    case "kiwify":
      return {
        name: "Kiwify",
        url: "https://app.kiwify.com.br",
        steps: [
          "Acesse app.kiwify.com.br → Produto → Página de Vendas",
          `Cole a Headline: "${get("headline").slice(0, 80)}"`,
          "Cole a Descrição Completa e os Benefícios",
          "Configure Bônus, Garantia e o botão de compra com o CTA gerado",
          "Revise e publique",
        ],
      };

    case "facebook":
      return {
        name: "Facebook / Meta Ads",
        url: "https://www.facebook.com",
        steps: [
          "Acesse Meta Ads Manager → Criar anúncio",
          "Cole o Texto Principal no campo de copy do anúncio",
          `Use a Headline "${get("headline")}" e a Descrição Curta "${get("descricao_curta")}"`,
          `Configure o botão CTA: "${get("cta")}" e adicione o criativo sugerido`,
          "Configure público, orçamento e publique",
        ],
      };

    case "instagram":
      return {
        name: "Instagram",
        url: "https://www.instagram.com",
        steps: [
          "Abra o Instagram → + → Nova publicação ou Reel",
          "Escolha o formato conforme a Sugestão de Criativo",
          `Cole a Primeira Frase de Impacto como abertura: "${get("primeira_frase").slice(0, 90)}"`,
          "Cole a Legenda completa com as Hashtags ao final",
          "Publique e monitore os Insights após 24h",
        ],
      };

    case "tiktok":
      return {
        name: "TikTok",
        url: "https://www.tiktok.com",
        steps: [
          "Abra o TikTok → + → Gravar ou importar vídeo",
          `Comece com o Gancho nos primeiros 2 segundos: "${get("gancho").slice(0, 80)}"`,
          "Siga o Roteiro gerado para o desenvolvimento e CTA final",
          "Cole a Legenda gerada e adicione as Hashtags",
          "Publique e monitore retenção nos primeiros 30 minutos",
        ],
      };

    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isCampaignComplete(r: CampaignResult | null): r is CampaignResult {
  if (!r) return false;
  if (r.platformFields && r.platformFields.length > 0) {
    return r.platformFields.some((f) => f.value?.trim());
  }
  return !!(r.headline?.trim() && r.audience?.trim());
}

function getBlockContent(data: CampaignResult, blockId: string): string {
  if (blockId.startsWith("platformField.")) {
    const key = blockId.replace("platformField.", "");
    return data.platformFields?.find((f) => f.key === key)?.value ?? "";
  }
  switch (blockId) {
    case "headline": return data.headline;
    case "audience": return data.audience;
    default: return "";
  }
}

function applyRefinedContent(prev: CampaignResult | null, blockId: string, content: string): CampaignResult | null {
  if (!prev) return prev;
  if (blockId.startsWith("platformField.")) {
    const key = blockId.replace("platformField.", "");
    return {
      ...prev,
      platformFields: prev.platformFields?.map((f) => f.key === key ? { ...f, value: content } : f),
    };
  }
  switch (blockId) {
    case "headline": return { ...prev, headline: content };
    case "audience": return { ...prev, audience: content };
    default: return prev;
  }
}

// ─── Platform card ────────────────────────────────────────────────────────────
function PlatformCard({
  platform, selected, onClick,
}: {
  platform: PlatformDef; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border transition-all duration-200 p-4 group overflow-hidden ${
        selected
          ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(201,168,76,0.3)]"
          : "border-white/[0.06] bg-[#0d0d0d] hover:border-white/[0.12] hover:bg-[#121212]"
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${platform.accent}18`, color: platform.accent }}
        >
          {platform.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <p className={`text-sm font-semibold leading-tight ${selected ? "text-primary" : "text-white"}`}>
              {platform.name}
            </p>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${platform.accent}18`, color: platform.accent }}
            >
              {platform.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-snug">{platform.description}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1 uppercase tracking-widest">{platform.focus}</p>
        </div>
      </div>
    </button>
  );
}

// ─── Mode selector ────────────────────────────────────────────────────────────
function ModeSelector({
  modes, selected, onSelect,
}: {
  modes: PlatformDef["modes"]; selected: string; onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          title={m.description}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            selected === m.value
              ? "border-primary/60 bg-primary/10 text-primary font-medium"
              : "border-white/[0.06] bg-[#0d0d0d] text-muted-foreground/70 hover:border-white/[0.12] hover:text-white"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Refine bar ───────────────────────────────────────────────────────────────
function RefineBar({
  blockId: _blockId, value, onChange, onRefine, isRefining, disabled,
}: {
  blockId: string; value: string; onChange: (v: string) => void;
  onRefine: () => void; isRefining: boolean; disabled: boolean;
}) {
  return (
    <div className="mt-2.5 flex gap-2 items-center">
      <input
        className="flex-1 text-xs bg-[#0a0a0a] border border-white/10 rounded px-2.5 py-1.5 text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 disabled:opacity-50"
        placeholder="Instrução de refinamento para este campo..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !isRefining && !disabled && value.trim()) onRefine(); }}
        disabled={isRefining || disabled}
      />
      <button
        onClick={onRefine}
        disabled={isRefining || disabled || !value.trim()}
        className="text-xs px-2.5 py-1.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 transition-colors"
      >
        {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
        Refinar
      </button>
    </div>
  );
}

// ─── Platform field block ─────────────────────────────────────────────────────
function PlatformFieldBlock({
  field, refineInput, onRefineChange, onRefine, isRefining, disabled,
}: {
  field: CampaignPlatformField; refineInput: string; onRefineChange: (v: string) => void;
  onRefine: () => void; isRefining: boolean; disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const charLimit = 300;
  const preview = field.value.slice(0, charLimit);
  const hasMore = field.value.length > charLimit;

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4">
      <div className="flex items-start justify-between mb-2 gap-2">
        <p className="text-xs font-semibold text-primary leading-tight">{field.label}</p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(field.value);
            toast({ description: `${field.label} copiado.` });
          }}
          className="text-muted-foreground hover:text-white transition-colors shrink-0"
          title="Copiar campo"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
        {expanded ? field.value : preview}
        {hasMore && !expanded && "..."}
      </p>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary/60 hover:text-primary mt-1.5 flex items-center gap-1 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver completo</>}
        </button>
      )}
      <RefineBar
        blockId={`platformField.${field.key}`}
        value={refineInput}
        onChange={onRefineChange}
        onRefine={onRefine}
        isRefining={isRefining}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Briefing criativo colapsável ─────────────────────────────────────────────
function CreativeBriefingBlock({ briefing }: { briefing: CampaignCreativeBriefing }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const entries = Object.entries(briefing).filter(([, v]) => v?.trim());

  const copyAll = () => {
    const text = entries.map(([k, v]) => `${BRIEFING_LABELS[k] ?? k}: ${v}`).join("\n");
    void navigator.clipboard.writeText(text);
    toast({ description: "Briefing copiado." });
  };

  return (
    <div className="border border-white/[0.05] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground/60" />
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium">Briefing Criativo</p>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />}
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
          <div className="flex justify-end">
            <button onClick={copyAll} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copiar tudo
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {entries.map(([key, value]) => (
              <div key={key} className="bg-[#0a0a0a] rounded p-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-0.5">
                  {BRIEFING_LABELS[key] ?? key}
                </p>
                <p className="text-xs text-zinc-300 leading-snug">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CreateCampaign() {
  const [step, setStep] = useState<"platform" | "form">("platform");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState("");
  const [productType, setProductType] = useState("");
  const { status, result, error, generate, reset } = useAiStream<CampaignResult>();
  const { toast } = useToast();
  const { saveItem } = useSavedItems();
  const { isFetching: fetchingCredits, refetch: refetchCredits } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey(), staleTime: 0 },
  });
  const refundCalledRef = useRef(false);
  useEffect(() => {
    if (status === "error" && !refundCalledRef.current) {
      refundCalledRef.current = true;
      fetch("/api/credits/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "campaign" }),
        credentials: "include",
      }).catch(() => {});
    }
    if (status === "idle" || status === "generating") refundCalledRef.current = false;
  }, [status]);

  const [isSaving, setIsSaving] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignResult | null>(null);
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningBlock, setRefiningBlock] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const currentPlatform = getPlatformByGoal(goal);

  // Reset mode when platform changes
  useEffect(() => {
    if (currentPlatform && currentPlatform.modes.length > 0) {
      setMode(currentPlatform.modes[0].value);
    }
  }, [goal]);

  // Prefill from other modules
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_campaign_prefill");
      if (!raw) return;
      sessionStorage.removeItem("iattom_campaign_prefill");
      const prefill = JSON.parse(raw) as { product?: string; goal?: string };
      if (prefill.product) setProduct(prefill.product);
      if (prefill.goal) { setGoal(prefill.goal); setStep("form"); }
    } catch {}
  }, []);

  // Reopen from Projetos Salvos
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_reopen_campaign_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_reopen_campaign_v1");
      const saved = JSON.parse(raw) as {
        briefing?: { product?: string; goal?: string; mode?: string; audience?: string; productType?: string };
        result?: CampaignResult;
      };
      if (saved.briefing?.product) setProduct(saved.briefing.product);
      if (saved.briefing?.goal) { setGoal(saved.briefing.goal); setStep("form"); }
      if (saved.briefing?.mode) setMode(saved.briefing.mode);
      if (saved.briefing?.audience) setAudience(saved.briefing.audience);
      if (saved.briefing?.productType) setProductType(saved.briefing.productType);
      if (saved.result) { setCampaignData(saved.result); setIsRestored(true); }
    } catch {}
  }, []);

  // Preservação global: restaurar último trabalho via localStorage
  useEffect(() => {
    if (sessionStorage.getItem("iattom_campaign_prefill") || sessionStorage.getItem("iattom_reopen_campaign_v1")) return;
    try {
      const persisted = loadModuleState<{ form: { product: string; audience: string; goal: string; mode: string; productType: string }; result: CampaignResult }>("campaign");
      if (persisted?.result) {
        if (persisted.form.product) setProduct(persisted.form.product);
        if (persisted.form.audience) setAudience(persisted.form.audience);
        if (persisted.form.goal) { setGoal(persisted.form.goal); setStep("form"); }
        if (persisted.form.mode) setMode(persisted.form.mode);
        if (persisted.form.productType) setProductType(persisted.form.productType);
        setCampaignData(persisted.result);
        setIsRestored(true);
      }
    } catch {}
  }, []);

  // Auto-salvar quando campaignData mudar
  useEffect(() => {
    if (campaignData) {
      saveModuleState("campaign", { form: { product, audience, goal, mode, productType }, result: campaignData });
    }
  }, [campaignData, product, audience, goal, mode, productType]);

  const handleReset = () => {
    reset();
    setCampaignData(null);
    setRefineInputs({});
    setRefiningBlock(null);
    setIsRestored(false);
    setStep("platform");
    setGoal("");
    setMode("");
    clearModuleState("campaign");
  };

  const handleBack = () => {
    reset();
    setCampaignData(null);
    setRefineInputs({});
    setRefiningBlock(null);
    setIsRestored(false);
    setStep("platform");
    setGoal("");
    setMode("");
  };

  const copyAllCampaign = () => {
    if (!campaignData) return;
    const lines: string[] = [];
    if (campaignData.platformFields?.length) {
      campaignData.platformFields.forEach((f) => {
        lines.push(`${f.label}:\n${f.value}`);
      });
    } else {
      if (campaignData.headline) lines.push(`Manchete: ${campaignData.headline}`);
      if (campaignData.subheadline) lines.push(`Submanchete: ${campaignData.subheadline}`);
      if (campaignData.cta) lines.push(`CTA: ${campaignData.cta}`);
      if (campaignData.audience) lines.push(`Público: ${campaignData.audience}`);
    }
    void navigator.clipboard.writeText(lines.join("\n\n"));
    toast({ description: "Campanha copiada." });
  };

  const selectPlatform = (platform: PlatformDef) => {
    setGoal(platform.goal);
    setMode(platform.modes[0].value);
    setStep("form");
  };

  const incompatibility = detectIncompatibility(getEffectiveProductType(product, productType || null), goal);
  const typeMismatch = detectProductTypeMismatch(product, productType || null);

  const runGenerate = (charge: () => void) => {
    if (isGenerating || !goal) return;
    generate("/api/ai/create-campaign", {
      product, audience: audience || undefined, goal: goal || undefined,
      mode: mode || undefined, productType: productType || undefined,
    }).then((res) => {
      if (res !== null) { charge(); setCampaignData(res); }
    });
  };

  const setRefineInput = (blockId: string, value: string) => {
    setRefineInputs((prev) => ({ ...prev, [blockId]: value }));
  };

  const refineBlock = async (blockId: string) => {
    const instruction = refineInputs[blockId] ?? "";
    if (!instruction.trim() || !campaignData || refiningBlock) return;
    setRefiningBlock(blockId);
    const currentContent = getBlockContent(campaignData, blockId);
    const campaignContext = [product, goal, mode].filter(Boolean).join(" / ");
    try {
      const res = await fetch("/api/ai/refine-campaign-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId, currentContent, instruction, campaignContext }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { refinedContent: string };
      setCampaignData((prev) => applyRefinedContent(prev, blockId, data.refinedContent));
      setRefineInputs((prev) => ({ ...prev, [blockId]: "" }));
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "Erro ao refinar campo", variant: "destructive" });
    } finally {
      setRefiningBlock(null);
    }
  };

  const handleSave = async () => {
    if (!campaignData || isSaving) return;
    const title = product.trim()
      ? `${product.trim()}${goal ? ` — ${currentPlatform?.name ?? goal}` : ""}`
      : (campaignData.platformFields?.[0]?.value?.slice(0, 60) ?? campaignData.headline ?? "Campanha");
    const platform = campaignData.platform;
    const lines: string[] = [];
    if (campaignData.platformFields && campaignData.platformFields.length > 0) {
      lines.push(`ENTREGA — ${currentPlatform?.name ?? goal}`);
      if (product.trim()) lines.push(`Produto: ${product.trim()}`);
      lines.push("");
      campaignData.platformFields.forEach((f) => { lines.push(`${f.label.toUpperCase()}:`); lines.push(f.value); lines.push(""); });
    } else {
      lines.push(`CAMPANHA: ${campaignData.headline}`);
      if (campaignData.audience) lines.push(`Público: ${campaignData.audience}`);
    }
    const content = lines.join("\n");
    const structuredData = JSON.stringify({ briefing: { product: product.trim(), goal, mode, audience, productType }, result: campaignData });
    const projectId = crypto.randomUUID();
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift({ id: projectId, title, type: "campaign", platform, content, data: structuredData, hasImages: false, createdAt: new Date().toISOString() });
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch {}
    setIsSaving(true);
    try {
      await saveItem({ id: projectId, title, type: "campaign", platform, content, data: structuredData, hasImages: false });
      toast({ description: "Projeto salvo em Projetos Salvos." });
    } catch { toast({ description: "Erro ao salvar. Tente novamente.", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const showResult = (isDone || isRestored) && isCampaignComplete(campaignData);
  const hasPlatformFields = !!(campaignData?.platformFields && campaignData.platformFields.length > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Entrega por Plataforma</p>
          <h2 className="text-2xl font-bold text-white mb-1">Criar Campanha</h2>
          <p className="text-muted-foreground text-sm">
            {step === "platform"
              ? "Escolha a plataforma. Gere exatamente os campos que você precisa — na ordem de copiar e colar."
              : currentPlatform
              ? `${currentPlatform.name} — ${currentPlatform.focus}`
              : "Configure e gere sua entrega."}
          </p>
        </div>
        {showResult && (
          <Button size="sm" variant="outline" onClick={() => { setIsRefreshing(true); void refetchCredits(); setTimeout(() => { try { const p = loadModuleState<{ form: { product: string; audience: string; goal: string; mode: string; productType: string }; result: CampaignResult }>("campaign"); if (p?.result) setCampaignData(p.result); } catch {} setIsRefreshing(false); }, 750); }} disabled={fetchingCredits || isRefreshing} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${(fetchingCredits || isRefreshing) ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </motion.div>

      {/* Restored banner */}
      {isRestored && campaignData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <p className="text-sm text-primary font-medium">Entrega restaurada de Projetos Salvos</p>
            </div>
            <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-white transition-colors">
              Novo
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Seleção de plataforma ── */}
        {!isRestored && step === "platform" && (
          <motion.div key="platform-select" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {PLATFORMS.map((platform) => (
                <PlatformCard
                  key={platform.key}
                  platform={platform}
                  selected={goal === platform.goal}
                  onClick={() => selectPlatform(platform)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Formulário ── */}
        {!isRestored && step === "form" && !showResult && !isGenerating && !isError && (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <Card className="bg-[#111111] border-white/5">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentPlatform && (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${currentPlatform.accent}18`, color: currentPlatform.accent }}
                      >
                        {currentPlatform.icon}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base font-semibold text-white">
                        {currentPlatform?.name ?? "Plataforma"}
                      </CardTitle>
                      {currentPlatform && (
                        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">{currentPlatform.focus}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep("platform")}
                    className="text-xs transition-colors flex items-center gap-1.5 hover:opacity-80"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" style={{ color: currentPlatform?.accent ?? "#C9A84C" }} />
                    <span className="text-muted-foreground">Trocar</span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Produto + Tipo */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Produto / Marca <span className="text-red-400">*</span></Label>
                    <Input
                      placeholder="ex: Garrafa HydroElite, Curso de Excel, Consultoria de Tráfego"
                      className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Tipo de Produto</Label>
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Selecionar tipo (opcional)</option>
                      <option value="Digital">Digital — curso, ebook, software, assinatura</option>
                      <option value="Físico">Físico — roupas, eletrônicos, suplementos</option>
                      <option value="Serviço">Serviço — consultoria, mentoria, agência</option>
                    </select>
                  </div>
                </div>

                {/* Modo — filtrado por plataforma */}
                {currentPlatform && currentPlatform.modes.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Modo da Entrega</Label>
                    <ModeSelector
                      modes={currentPlatform.modes}
                      selected={mode}
                      onSelect={setMode}
                    />
                    {mode && (
                      <p className="text-xs text-muted-foreground/50">
                        {currentPlatform.modes.find((m) => m.value === mode)?.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Público-alvo */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Público-alvo (opcional)</Label>
                  <Input
                    placeholder="ex: Mulheres 25-40 interessadas em bem-estar, atletas amadores"
                    className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>

                {/* Alerts */}
                {(incompatibility || typeMismatch) && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3.5 py-3">
                    <AlertCircle className="w-4 h-4 text-yellow-400/80 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-200/70 leading-relaxed">Esta combinação pode exigir adaptação de estratégia. A entrega será gerada normalmente.</p>
                  </div>
                )}

                <CreditsGate
                  feature="campaign"
                  onSuccess={runGenerate}
                  disabled={!product.trim() || isGenerating}
                >
                  {({ trigger, isLoading }) => (
                    <Button
                      onClick={trigger}
                      disabled={isLoading || isGenerating || !product.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full disabled:opacity-40"
                    >
                      {isLoading || isGenerating
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando entrega...</>
                        : `Gerar Entrega para ${currentPlatform?.name ?? "Plataforma"}`}
                    </Button>
                  )}
                </CreditsGate>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Generating ── */}
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm">Gerando campos para {currentPlatform?.name ?? "plataforma"}...</span>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-white/[0.03] border border-white/[0.04] animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">Falha na geração</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{error ?? "Não foi possível gerar a entrega. Tente novamente."}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { reset(); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Result skeleton on refresh ── */}
        {showResult && isRefreshing && (
          <motion.div key="refreshing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="space-y-3 animate-pulse">
              <div className="h-32 rounded-lg bg-white/5 border border-white/5" />
              <div className="h-24 rounded-lg bg-white/5 border border-white/5" />
            </div>
          </motion.div>
        )}

        {/* ── Result ── */}
        {showResult && campaignData && !isRefreshing && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <Card className="bg-[#111111] border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {currentPlatform && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${currentPlatform.accent}18`, color: currentPlatform.accent }}
                    >
                      {currentPlatform.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base text-white flex items-baseline gap-1 flex-wrap">
                      <span className="shrink-0">{currentPlatform?.name ?? "Entrega"}</span>
                      {product.trim() && (
                        <span className="text-muted-foreground/60 font-normal text-sm truncate min-w-0">— {product.trim()}</span>
                      )}
                    </CardTitle>
                    {mode && (
                      <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                        {currentPlatform?.focus ?? ""}{mode ? ` · ${mode}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={handleBack} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3" /><span className="hidden sm:inline">Voltar</span>
                    </button>
                    <button onClick={copyAllCampaign} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                      <Copy className="w-3 h-3" /><span className="hidden sm:inline">Copiar Tudo</span>
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50">
                      <Save className="w-3 h-3" /><span className="hidden sm:inline">{isSaving ? "Salvando..." : "Salvar"}</span>
                    </button>
                    <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-white transition-colors">
                      Novo
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* ── Campos por plataforma ── */}
                {hasPlatformFields && campaignData.platformFields && (
                  <>
                    <div className="flex items-center gap-2 pb-1 border-b border-white/[0.05]">
                      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium">
                        Entrega da plataforma — copie e cole na ordem
                      </p>
                    </div>

                    <div className="space-y-3">
                      {campaignData.platformFields.map((field) => {
                        const blockId = `platformField.${field.key}`;
                        return (
                          <PlatformFieldBlock
                            key={field.key}
                            field={field}
                            refineInput={refineInputs[blockId] ?? ""}
                            onRefineChange={(v) => setRefineInput(blockId, v)}
                            onRefine={() => refineBlock(blockId)}
                            isRefining={refiningBlock === blockId}
                            disabled={!!refiningBlock && refiningBlock !== blockId}
                          />
                        );
                      })}
                    </div>

                    {/* Briefing criativo colapsável */}
                    {campaignData.creativeBriefing && (
                      <CreativeBriefingBlock briefing={campaignData.creativeBriefing} />
                    )}
                  </>
                )}

                {/* ── Fallback legado ── */}
                {!hasPlatformFields && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
                      <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Manchete</p>
                      <p className="text-white font-bold text-lg leading-snug">{campaignData.headline}</p>
                      {campaignData.subheadline && <p className="text-muted-foreground text-sm mt-1">{campaignData.subheadline}</p>}
                      {campaignData.cta && <p className="text-primary text-sm font-semibold mt-2">CTA: {campaignData.cta}</p>}
                    </div>
                    {campaignData.audience && (
                      <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Público</p>
                        <p className="text-sm text-white">{campaignData.audience}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Publicação Assistida — máx 5 passos ── */}
                {hasPlatformFields && campaignData.platformFields && (() => {
                  const guide = getPlatformGuide(campaignData.platform, campaignData.platformFields);
                  if (!guide) return null;
                  return (
                    <div className="border-t border-white/[0.05] pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-medium">Publicação Assistida</p>
                        <a
                          href={guide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/40 rounded px-2 py-1 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir {guide.name}
                        </a>
                      </div>
                      <div className="bg-[#0a0a0a] border border-primary/10 rounded-lg px-4 py-3">
                        <ol className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="text-primary font-bold text-xs shrink-0 mt-0.5 w-4">{i + 1}.</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })()}

              </CardContent>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
