import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Target, Globe, Loader2, Copy, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Zap, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import { CampaignCreativePanel } from "@/pages/dashboard/CampaignCreativePanel";
import type { CampaignResult } from "@/types/ai";

const platformIcons: Record<string, string> = {
  facebook: "fb", instagram: "ig", google: "g", email: "em", tiktok: "tk",
};

const DIGITAL_GOALS = ["Vender na Hotmart", "Vender na Kiwify"];
const PHYSICAL_GOALS = ["Vender na Shopee", "Vender no Mercado Livre"];

const DIGITAL_KEYWORDS = [
  "curso", "ebook", "e-book", "planilha", "template", "mentoria", "consultoria",
  "coaching", "treinamento", "workshop", "masterclass", "aula", "infoproduto",
  "formação", "certificação", "programa", "método", "sistema", "software", "saas",
  "pdf", "videoaula", "módulo", "digital", "online", "assinatura", "acesso",
];
const PHYSICAL_KEYWORDS = [
  "roupa", "camiseta", "tênis", "sapato", "calçado", "bolsa", "mochila",
  "eletrônico", "celular", "tablet", "garrafa", "utensílio", "cosmético",
  "perfume", "kit", "aparelho", "dispositivo", "equipamento", "alimento",
  "suplemento", "vitamina", "remédio", "skincare", "caderno", "agenda",
  "óculos", "relógio", "acessório", "brinquedo", "produto físico", "tênis",
];

interface CompatAlert {
  title: string;
  message: string;
  suggestions: string[];
}

function detectProductType(name: string): "digital" | "physical" | "unknown" {
  const lower = name.toLowerCase();
  const isDigital = DIGITAL_KEYWORDS.some((k) => lower.includes(k));
  const isPhysical = PHYSICAL_KEYWORDS.some((k) => lower.includes(k));
  if (isDigital && !isPhysical) return "digital";
  if (isPhysical && !isDigital) return "physical";
  return "unknown";
}

function getCompatAlert(product: string, goal: string): CompatAlert | null {
  if (!goal || !product.trim()) return null;
  const type = detectProductType(product);
  if (type === "unknown") return null;

  if (DIGITAL_GOALS.includes(goal) && type === "physical") {
    const platform = goal.replace("Vender na ", "").replace("Vender no ", "");
    return {
      title: `Produto físico detectado`,
      message: `${platform} é uma plataforma voltada para produtos digitais (cursos, ebooks, mentorias, infoprodutos). Gerar uma campanha nessa combinação pode desperdiçar seus créditos.`,
      suggestions: [
        `Transformar em produto digital (ex: curso ou ebook sobre o tema)`,
        `Migrar o objetivo para Shopee ou Mercado Livre`,
        `Atuar como afiliado de um infoproduto relacionado na ${platform}`,
      ],
    };
  }

  if (PHYSICAL_GOALS.includes(goal) && type === "digital") {
    const platform = goal.replace("Vender na ", "").replace("Vender no ", "");
    return {
      title: `Produto digital detectado`,
      message: `${platform} é uma plataforma voltada para produtos físicos. Gerar uma campanha nessa combinação pode desperdiçar seus créditos.`,
      suggestions: [
        `Migrar o objetivo para Hotmart ou Kiwify`,
        `Adaptar para entrega física (apostila ou livro impresso)`,
        `Explorar venda pelo Instagram ou WhatsApp`,
      ],
    };
  }

  return null;
}

function isCampaignComplete(r: CampaignResult | null): r is CampaignResult {
  if (!r) return false;
  if (!r.headline?.trim()) return false;
  if (!r.audience?.trim()) return false;
  if (!Array.isArray(r.channels) || r.channels.length === 0) return false;
  if (!r.budget?.trim()) return false;
  if (!r.copy || typeof r.copy !== "object") return false;
  const copyValues = Object.values(r.copy as Record<string, string>);
  if (copyValues.every((v) => !v?.trim())) return false;
  if (!Array.isArray(r.keyMessages) || r.keyMessages.length === 0) return false;
  return true;
}

function getBlockContent(data: CampaignResult, blockId: string): string {
  if (blockId.startsWith("copy.")) {
    const platform = blockId.replace("copy.", "");
    return (data.copy as Record<string, string>)[platform] ?? "";
  }
  switch (blockId) {
    case "headline": return data.headline;
    case "audience": return data.audience;
    case "budget": return data.budget;
    case "uniqueAngle": return data.uniqueAngle ?? "";
    case "launchTimeline": return data.launchTimeline;
    case "keyMessages": return data.keyMessages.join("\n");
    default: return "";
  }
}

function applyRefinedContent(prev: CampaignResult | null, blockId: string, content: string): CampaignResult | null {
  if (!prev) return prev;
  if (blockId.startsWith("copy.")) {
    const platform = blockId.replace("copy.", "");
    return { ...prev, copy: { ...prev.copy, [platform]: content } };
  }
  switch (blockId) {
    case "headline": return { ...prev, headline: content };
    case "audience": return { ...prev, audience: content };
    case "budget": return { ...prev, budget: content };
    case "uniqueAngle": return { ...prev, uniqueAngle: content };
    case "launchTimeline": return { ...prev, launchTimeline: content };
    case "keyMessages": return { ...prev, keyMessages: content.split("\n").map((s) => s.trim()).filter(Boolean) };
    default: return prev;
  }
}

interface RefineBarProps {
  blockId: string;
  value: string;
  onChange: (v: string) => void;
  onRefine: () => void;
  isRefining: boolean;
  disabled: boolean;
}

function RefineBar({ blockId, value, onChange, onRefine, isRefining, disabled }: RefineBarProps) {
  return (
    <div className="mt-2 flex gap-2 items-center">
      <input
        className="flex-1 text-xs bg-[#0a0a0a] border border-white/10 rounded px-2.5 py-1.5 text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 disabled:opacity-50"
        placeholder="Instrução de refinamento para este bloco..."
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

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const preview = content.slice(0, 120);
  const hasMore = content.length > 120;

  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-primary capitalize">{label}</p>
        <button
          onClick={() => { navigator.clipboard.writeText(content); toast({ description: `Copy de ${label} copiado` }); }}
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {expanded ? content : preview}
        {hasMore && !expanded && "..."}
      </p>
      {hasMore && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary/60 hover:text-primary mt-1.5 flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3 h-3" /> Menos</> : <><ChevronDown className="w-3 h-3" /> Ver mais</>}
        </button>
      )}
    </div>
  );
}

export function CreateCampaign() {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState("");
  const [bypassCompat, setBypassCompat] = useState(false);
  const { status, result, error, generate, reset } = useAiStream<CampaignResult>();
  const { toast } = useToast();

  const [campaignData, setCampaignData] = useState<CampaignResult | null>(null);
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningBlock, setRefiningBlock] = useState<string | null>(null);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const compatAlert = bypassCompat ? null : getCompatAlert(product, goal);
  const isBlocked = compatAlert !== null;

  useEffect(() => { setBypassCompat(false); }, [product, goal]);

  const handleReset = () => {
    reset();
    setCampaignData(null);
    setRefineInputs({});
    setRefiningBlock(null);
  };

  const runGenerate = (charge: () => void) => {
    if (isGenerating) return;
    generate("/api/ai/create-campaign", {
      product,
      audience: audience || undefined,
      goal: goal || undefined,
      mode: mode || undefined,
    }).then((res) => {
      if (res !== null) {
        charge();
        setCampaignData(res);
      }
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
      toast({
        description: err instanceof Error ? err.message : "Erro ao refinar bloco",
        variant: "destructive",
      });
    } finally {
      setRefiningBlock(null);
    }
  };

  const copyAll = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copiado para a área de transferência" });
  };

  const saveToHotmart = () => {
    if (!campaignData) return;
    const title = product.trim()
      ? `${product.trim()}${goal ? ` — ${goal}` : ""}`
      : campaignData.headline;

    const lines: string[] = [];
    lines.push(`CAMPANHA: ${campaignData.headline}`);
    if (campaignData.subheadline) lines.push(`Subheadline: ${campaignData.subheadline}`);
    if (campaignData.cta) lines.push(`CTA: ${campaignData.cta}`);
    lines.push(`\nPÚBLICO: ${campaignData.audience}`);
    if (campaignData.channels?.length) lines.push(`CANAIS: ${campaignData.channels.join(", ")}`);
    lines.push(`ORÇAMENTO: ${campaignData.budget}`);
    if (campaignData.uniqueAngle) lines.push(`\nÂNGULO ÚNICO: ${campaignData.uniqueAngle}`);
    if (campaignData.keyMessages?.length) {
      lines.push(`\nMENSAGENS-CHAVE:`);
      campaignData.keyMessages.forEach((m, i) => lines.push(`  ${i + 1}. ${m}`));
    }
    if (campaignData.copy && typeof campaignData.copy === "object") {
      lines.push(`\nCOPY POR PLATAFORMA:`);
      Object.entries(campaignData.copy as Record<string, string>).forEach(([platform, copy]) => {
        lines.push(`\n[${platform.toUpperCase()}]\n${copy}`);
      });
    }
    if (campaignData.launchTimeline) lines.push(`\nCRONOGRAMA:\n${campaignData.launchTimeline}`);

    const content = lines.join("\n");
    const newCampaign = { id: crypto.randomUUID(), title, content };

    try {
      const raw = localStorage.getItem("iattom_hotmart_campaigns_v1");
      const existing: typeof newCampaign[] = raw ? (JSON.parse(raw) as typeof newCampaign[]) : [];
      existing.unshift(newCampaign);
      localStorage.setItem("iattom_hotmart_campaigns_v1", JSON.stringify(existing));
      toast({ description: "Campanha salva no painel Hotmart." });
    } catch {
      toast({ description: "Erro ao salvar campanha.", variant: "destructive" });
    }
  };

  const showResult = isDone && isCampaignComplete(campaignData);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Construtor de Campanha</p>
        <h2 className="text-2xl font-bold text-white mb-1">Criar Campanha</h2>
        <p className="text-muted-foreground text-sm">Gere uma estratégia completa de campanha com copy criado para cada plataforma.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-[#111111] border-white/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-white">Briefing da Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Produto / Marca</Label>
                <Input placeholder="ex: Garrafa HydroElite" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={product} onChange={(e) => setProduct(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Objetivo da Campanha</Label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="" disabled>Selecionar objetivo</option>
                  <option value="Vender na Shopee">Vender na Shopee</option>
                  <option value="Vender no Mercado Livre">Vender no Mercado Livre</option>
                  <option value="Vender na Hotmart">Vender na Hotmart</option>
                  <option value="Vender na Kiwify">Vender na Kiwify</option>
                  <option value="Vender pelo WhatsApp">Vender pelo WhatsApp</option>
                  <option value="Vender pelo Instagram">Vender pelo Instagram</option>
                  <option value="Viralizar no Instagram">Viralizar no Instagram</option>
                  <option value="Viralizar no TikTok">Viralizar no TikTok</option>
                  <option value="Gerar Leads">Gerar Leads</option>
                  <option value="Captar Afiliados">Captar Afiliados</option>
                  <option value="Lançar Produto Novo">Lançar Produto Novo</option>
                  <option value="Escalar Produto Vencedor">Escalar Produto Vencedor</option>
                  <option value="Recuperar Produto Fraco">Recuperar Produto Fraco</option>
                  <option value="Criar Autoridade">Criar Autoridade</option>
                  <option value="Reconhecimento de Marca">Reconhecimento de Marca</option>
                  <option value="Tráfego para Site">Tráfego para Site</option>
                  <option value="Instalações de App">Instalações de App</option>
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Modo da Campanha</Label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full h-9 rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-1 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                >
                  <option value="">Padrão (Conversão)</option>
                  <option value="Iniciante">Iniciante — primeiras vendas, orçamento baixo</option>
                  <option value="Orgânico">Orgânico — sem tráfego pago, conteúdo e creators</option>
                  <option value="Baixo orçamento">Baixo orçamento — máx. R$1.500/mês, enxuto</option>
                  <option value="Conversão">Conversão — venda imediata, funil direto</option>
                  <option value="Viral">Viral — UGC, retenção, compartilhamento</option>
                  <option value="Agressivo">Agressivo — alta pressão, remarketing, A/B</option>
                  <option value="Premium">Premium — posicionamento de alto valor</option>
                  <option value="Escala">Escala — expansão de produto já validado</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Público-alvo (opcional)</Label>
              <Input placeholder="ex: Atletas 25-40, entusiastas de atividades ao ar livre" className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            {isBlocked && compatAlert && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-semibold text-amber-400">{compatAlert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{compatAlert.message}</p>
                  </div>
                </div>
                <div className="space-y-1 pl-6">
                  <p className="text-xs text-muted-foreground font-medium">Alternativas sugeridas:</p>
                  {compatAlert.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-amber-500/60 shrink-0">•</span>{s}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setBypassCompat(true)}
                  className="pl-6 text-xs text-muted-foreground hover:text-white transition-colors underline underline-offset-2"
                >
                  Gerar mesmo assim
                </button>
              </div>
            )}
            <CreditsGate feature="campaign" onSuccess={runGenerate} disabled={!product.trim() || isGenerating || isBlocked}>
              {({ trigger, isLoading }) => (
                <Button onClick={trigger} disabled={isLoading || isGenerating || !product.trim() || isBlocked} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                  {isLoading || isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Construindo sua campanha...</>
                  ) : "Gerar Campanha"}
                </Button>
              )}
            </CreditsGate>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {isGenerating && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 text-muted-foreground mb-5">
              <div className="flex gap-1">{[0, 1, 2].map((i) => (<span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />))}</div>
              <span className="text-sm">Criando sua estratégia de campanha...</span>
            </div>
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-40 rounded-lg bg-white/5 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />))}</div>
          </motion.div>
        )}

        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-red-950/20 border-red-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1"><p className="text-sm font-semibold text-red-400">Falha na geração</p><p className="text-xs text-muted-foreground mt-0.5">{error}</p></div>
                <Button size="sm" variant="outline" onClick={() => { handleReset(); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showResult && campaignData && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <Card className="bg-[#111111] border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base text-white">Estratégia de Campanha</CardTitle>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={saveToHotmart}
                      className="text-xs text-primary/80 hover:text-primary transition-colors flex items-center gap-1 border border-primary/20 hover:border-primary/40 rounded px-2 py-1 bg-primary/5 hover:bg-primary/10"
                    >
                      <Save className="w-3 h-3" /> Salvar para Hotmart
                    </button>
                    <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Nova campanha
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Manchete */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
                  <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Manchete</p>
                  <p className="text-white font-bold text-lg leading-snug">{campaignData.headline}</p>
                  <p className="text-muted-foreground text-sm mt-1">{campaignData.subheadline}</p>
                  {campaignData.cta && <p className="text-primary text-sm font-semibold mt-2">CTA: {campaignData.cta}</p>}
                  <RefineBar
                    blockId="headline"
                    value={refineInputs["headline"] ?? ""}
                    onChange={(v) => setRefineInput("headline", v)}
                    onRefine={() => refineBlock("headline")}
                    isRefining={refiningBlock === "headline"}
                    disabled={!!refiningBlock && refiningBlock !== "headline"}
                  />
                </div>

                {/* Público / Canais / Orçamento */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><Target className="w-3 h-3" /> Público</p>
                    <p className="text-sm text-white">{campaignData.audience}</p>
                    <RefineBar
                      blockId="audience"
                      value={refineInputs["audience"] ?? ""}
                      onChange={(v) => setRefineInput("audience", v)}
                      onRefine={() => refineBlock("audience")}
                      isRefining={refiningBlock === "audience"}
                      disabled={!!refiningBlock && refiningBlock !== "audience"}
                    />
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Canais</p>
                    <div className="flex flex-wrap gap-1">
                      {campaignData.channels?.map((c) => (<span key={c} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{c}</span>))}
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Orçamento</p>
                    <p className="text-sm text-white">{campaignData.budget}</p>
                    <RefineBar
                      blockId="budget"
                      value={refineInputs["budget"] ?? ""}
                      onChange={(v) => setRefineInput("budget", v)}
                      onRefine={() => refineBlock("budget")}
                      isRefining={refiningBlock === "budget"}
                      disabled={!!refiningBlock && refiningBlock !== "budget"}
                    />
                  </div>
                </div>

                {/* Ângulo Único */}
                {campaignData.uniqueAngle && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/5">
                    <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-primary font-medium mb-0.5">Ângulo Único</p>
                      <p className="text-xs text-muted-foreground">{campaignData.uniqueAngle}</p>
                      <RefineBar
                        blockId="uniqueAngle"
                        value={refineInputs["uniqueAngle"] ?? ""}
                        onChange={(v) => setRefineInput("uniqueAngle", v)}
                        onRefine={() => refineBlock("uniqueAngle")}
                        isRefining={refiningBlock === "uniqueAngle"}
                        disabled={!!refiningBlock && refiningBlock !== "uniqueAngle"}
                      />
                    </div>
                  </div>
                )}

                {/* Copy por Plataforma */}
                {campaignData.copy && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-medium">Copy por Plataforma</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      {Object.entries(campaignData.copy).map(([platform, copy]) => {
                        const blockId = `copy.${platform}`;
                        return (
                          <div key={platform} className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4">
                            <CopyBlock label={platform} content={copy} />
                            <RefineBar
                              blockId={blockId}
                              value={refineInputs[blockId] ?? ""}
                              onChange={(v) => setRefineInput(blockId, v)}
                              onRefine={() => refineBlock(blockId)}
                              isRefining={refiningBlock === blockId}
                              disabled={!!refiningBlock && refiningBlock !== blockId}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mensagens-chave */}
                {campaignData.keyMessages?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">Mensagens-chave</p>
                    <div className="space-y-1.5">
                      {campaignData.keyMessages.map((msg, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-bold shrink-0 text-xs mt-0.5">{i + 1}</span>
                          <p className="text-muted-foreground text-xs">{msg}</p>
                        </div>
                      ))}
                    </div>
                    <RefineBar
                      blockId="keyMessages"
                      value={refineInputs["keyMessages"] ?? ""}
                      onChange={(v) => setRefineInput("keyMessages", v)}
                      onRefine={() => refineBlock("keyMessages")}
                      isRefining={refiningBlock === "keyMessages"}
                      disabled={!!refiningBlock && refiningBlock !== "keyMessages"}
                    />
                  </div>
                )}

                {/* Cronograma */}
                {campaignData.launchTimeline && (
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Cronograma de Lançamento</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{campaignData.launchTimeline}</p>
                    <RefineBar
                      blockId="launchTimeline"
                      value={refineInputs["launchTimeline"] ?? ""}
                      onChange={(v) => setRefineInput("launchTimeline", v)}
                      onRefine={() => refineBlock("launchTimeline")}
                      isRefining={refiningBlock === "launchTimeline"}
                      disabled={!!refiningBlock && refiningBlock !== "launchTimeline"}
                    />
                  </div>
                )}

                {/* Criativo da Campanha — inline, mesmo pacote */}
                <CampaignCreativePanel
                  product={product}
                  goal={goal}
                  audience={audience || campaignData.audience}
                  headline={campaignData.headline}
                  uniqueAngle={campaignData.uniqueAngle}
                  instagramCopy={(campaignData.copy as Record<string, string>)?.instagram}
                  channels={campaignData.channels}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
