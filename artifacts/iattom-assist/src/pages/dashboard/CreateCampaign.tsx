import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Target, Globe, Loader2, Copy, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Zap, AlertTriangle, Save, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditsGate } from "@/components/CreditsGate";
import { useAiStream } from "@/hooks/useAiStream";
import { CampaignCreativePanel } from "@/pages/dashboard/CampaignCreativePanel";
import type { CampaignResult, CreativeIdeasResult } from "@/types/ai";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface PlatformGuide {
  name: string;
  url: string;
  steps: string[];
  note: string;
}

function getPlatformGuide(goal: string, data: CampaignResult): PlatformGuide | null {
  const g = goal.toLowerCase();
  const headline = data.headline ?? "";
  const cta = data.cta ?? "";
  const copy = data.copy as Record<string, string>;

  if (g.includes("hotmart")) {
    return {
      name: "Hotmart",
      url: "https://app.hotmart.com",
      steps: [
        "Acesse app.hotmart.com e faça login na sua conta",
        "Vá em Meus Produtos e selecione o produto desta campanha",
        `Em Marketing > Páginas, crie uma nova página com a manchete: "${headline}"`,
        `Defina o botão de compra com o CTA: "${cta}"`,
        "Copie os textos de cada plataforma abaixo para os canais correspondentes",
        "Em Afiliados > Programa de Afiliados, ative o link de afiliado para ampliar alcance",
        "Acompanhe as conversões em Relatórios > Vendas após publicar",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("kiwify")) {
    return {
      name: "Kiwify",
      url: "https://app.kiwify.com.br",
      steps: [
        "Acesse app.kiwify.com.br e faça login",
        "Selecione o produto e acesse Configurações > Página de Vendas",
        `Atualize o título principal com: "${headline}"`,
        `Configure o botão de compra com: "${cta}"`,
        "Copie o copy de e-mail e WhatsApp abaixo — principais canais de conversão na Kiwify",
        "Ative o programa de afiliados em Afiliados > Configurações",
        "Monitore as vendas em Dashboard > Transações",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("shopee")) {
    return {
      name: "Shopee",
      url: "https://seller.shopee.com.br",
      steps: [
        "Acesse seller.shopee.com.br e faça login no Seller Centre",
        "Vá em Meus Produtos e selecione o produto",
        `Atualize o título com palavras-chave baseadas em: "${headline}"`,
        "Adicione o copy de Instagram desta campanha na descrição do produto",
        "Configure cupons de desconto em Marketing > Vouchers",
        "Ative Oferta Relâmpago para aumentar a visibilidade",
        "Acompanhe a performance em Análise de Dados > Produtos",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("mercado livre")) {
    return {
      name: "Mercado Livre",
      url: "https://www.mercadolivre.com.br",
      steps: [
        "Acesse Mercado Livre e faça login como vendedor",
        "Vá em Meus Anúncios e selecione o produto",
        `Atualize o título do anúncio com: "${headline}"`,
        "Adicione o copy de Facebook desta campanha na descrição",
        "Configure Produto Patrocinado em Publicidade",
        "Monitore visitas e conversões em Central do Vendedor",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("whatsapp")) {
    return {
      name: "WhatsApp Business",
      url: "https://business.whatsapp.com",
      steps: [
        "Abra o WhatsApp Business na sua conta",
        `Crie um Catálogo com o produto e use como título: "${headline}"`,
        `Envie a primeira mensagem de prospecção usando o copy: "${(copy.instagram ?? cta).slice(0, 100)}"`,
        "Configure resposta automática com o link de compra",
        "Crie uma lista de transmissão para clientes interessados",
        "Use as Mensagens-chave desta campanha em sequência de follow-up",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("instagram")) {
    return {
      name: "Instagram",
      url: "https://www.instagram.com",
      steps: [
        "Acesse o Instagram e vá em Criar > Nova publicação",
        `Use como legenda o copy de Instagram desta campanha`,
        `Coloque a manchete "${headline}" nos primeiros 125 caracteres`,
        "Publique como Reels para maior alcance orgânico",
        `Use o CTA "${cta}" no caption e no sticker de link nos Stories`,
        "Acompanhe o desempenho em Insights do perfil",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  if (g.includes("tiktok")) {
    return {
      name: "TikTok",
      url: "https://www.tiktok.com",
      steps: [
        "Abra o TikTok e grave um vídeo usando o hook nos primeiros 2 segundos",
        "Adicione legendas na tela com o texto principal da campanha",
        `No caption use: "${(copy.tiktok ?? headline).slice(0, 100)}"`,
        `Finalize em voz com o CTA: "${cta}"`,
        "Poste entre 18h e 21h para maior alcance orgânico",
      ],
      note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
    };
  }
  return null;
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
  const [creativeResult, setCreativeResult] = useState<CreativeIdeasResult | null>(null);
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningBlock, setRefiningBlock] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  const isGenerating = status === "generating";
  const isDone = status === "done";
  const isError = status === "error";

  const compatAlert = bypassCompat ? null : getCompatAlert(product, goal);
  const isBlocked = compatAlert !== null;

  useEffect(() => { setBypassCompat(false); }, [product, goal]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_campaign_prefill");
      if (!raw) return;
      sessionStorage.removeItem("iattom_campaign_prefill");
      const prefill = JSON.parse(raw) as { product?: string; goal?: string; platform?: string };
      if (prefill.product) setProduct(prefill.product);
      if (prefill.goal) setGoal(prefill.goal);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("iattom_reopen_campaign_v1");
      if (!raw) return;
      sessionStorage.removeItem("iattom_reopen_campaign_v1");
      const saved = JSON.parse(raw) as {
        briefing?: { product?: string; goal?: string; mode?: string; audience?: string };
        result?: CampaignResult;
        creatives?: CreativeIdeasResult;
      };
      if (saved.briefing?.product) setProduct(saved.briefing.product);
      if (saved.briefing?.goal) setGoal(saved.briefing.goal);
      if (saved.briefing?.mode) setMode(saved.briefing.mode);
      if (saved.briefing?.audience) setAudience(saved.briefing.audience);
      if (saved.result) {
        setCampaignData(saved.result);
        setIsRestored(true);
      }
      if (saved.creatives) setCreativeResult(saved.creatives);
    } catch {}
  }, []);

  const handleReset = () => {
    reset();
    setCampaignData(null);
    setCreativeResult(null);
    setRefineInputs({});
    setRefiningBlock(null);
    setIsRestored(false);
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

  const handleSaveAndDownload = () => {
    if (!campaignData) return;
    const title = product.trim()
      ? `${product.trim()}${goal ? ` — ${goal}` : ""}`
      : campaignData.headline;

    const goalLower = goal.toLowerCase();
    let platform: string | undefined;
    if (goalLower.includes("hotmart")) platform = "hotmart";
    else if (goalLower.includes("kiwify")) platform = "kiwify";
    else if (goalLower.includes("shopee")) platform = "shopee";
    else if (goalLower.includes("mercado livre")) platform = "mercado_livre";
    else if (goalLower.includes("whatsapp")) platform = "whatsapp";
    else if (goalLower.includes("instagram")) platform = "instagram";
    else if (goalLower.includes("tiktok")) platform = "tiktok";

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
      Object.entries(campaignData.copy as Record<string, string>).forEach(([p, c]) => {
        lines.push(`\n[${p.toUpperCase()}]\n${c}`);
      });
    }
    if (campaignData.launchTimeline) lines.push(`\nCRONOGRAMA:\n${campaignData.launchTimeline}`);
    const content = lines.join("\n");

    const structuredData = JSON.stringify({
      briefing: { product: product.trim(), goal, mode, audience },
      result: campaignData,
      creatives: creativeResult ?? null,
    });
    const entry = {
      id: crypto.randomUUID(),
      title,
      type: "campaign",
      platform,
      content,
      data: structuredData,
      createdAt: new Date().toISOString(),
    };
    try {
      const raw = localStorage.getItem("iattom_saved_items_v1");
      const existing = raw ? (JSON.parse(raw) as object[]) : [];
      existing.unshift(entry);
      localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
    } catch {}

    const copyObj = campaignData.copy as Record<string, string>;
    const creativesSection = creativeResult?.concepts?.length
      ? `<h2>Criativos</h2>
${creativeResult.overarchingTheme ? `<div class="field"><div class="label">Tema Criativo</div><div class="value">${escapeHtml(creativeResult.overarchingTheme)}</div></div>` : ""}
${creativeResult.concepts.map((c, i) => `<div class="creative-card"><h3>Criativo ${i + 1} — ${escapeHtml(c.label)} (${escapeHtml(c.format)})</h3>${c.imageBase64 ? `<img src="data:image/png;base64,${c.imageBase64}" style="max-width:100%;border-radius:8px;margin:8px 0;border:1px solid #eee;">` : ""}<div class="field"><div class="label">Hook</div><div class="value">${escapeHtml(c.copyHook)}</div></div><div class="field"><div class="label">Copy</div><div class="value">${escapeHtml(c.bodyText)}</div></div><div class="field"><div class="label">CTA</div><div class="value">${escapeHtml(c.cta)}</div></div>${c.imagePrompt ? `<div class="field"><div class="label">Prompt IA</div><div class="value">${escapeHtml(c.imagePrompt)}</div></div>` : ""}</div>`).join("")}`
      : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:2rem;background:#fff;color:#1a1a1a}h1{font-size:1.5rem;border-bottom:3px solid #C9A84C;padding-bottom:.5rem;margin-bottom:1.5rem}h2{font-size:1rem;color:#C9A84C;margin-top:2rem;margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em}h3{font-size:.875rem;color:#555;margin-top:1.25rem;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.05em}.field{margin-bottom:1rem}.label{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:.25rem}.value{font-size:.9rem;white-space:pre-wrap;background:#f9f9f9;padding:.75rem;border-radius:4px;border:1px solid #eee;line-height:1.6}.chip{display:inline-block;background:#f0e8d5;color:#8a6d2a;border-radius:3px;padding:2px 8px;font-size:.8rem;margin:2px}ul{padding-left:1.25rem;margin:0}li{margin-bottom:.5rem;font-size:.9rem;line-height:1.5}.creative-card{border:1px solid #eee;border-radius:8px;padding:1rem;margin-bottom:1rem;background:#fafafa}.footer{margin-top:3rem;font-size:.7rem;color:#aaa;border-top:1px solid #eee;padding-top:1rem;text-align:center}</style>
</head><body>
<h1>${escapeHtml(title)}</h1>
${product.trim() ? `<p style="color:#888;font-size:.85rem;">Produto: ${escapeHtml(product)}${goal ? ` · ${escapeHtml(goal)}` : ""}</p>` : ""}
<h2>Manchete</h2>
<div class="field"><div class="label">Headline</div><div class="value">${escapeHtml(campaignData.headline)}</div></div>
${campaignData.subheadline ? `<div class="field"><div class="label">Subheadline</div><div class="value">${escapeHtml(campaignData.subheadline)}</div></div>` : ""}
${campaignData.cta ? `<div class="field"><div class="label">CTA</div><div class="value">${escapeHtml(campaignData.cta)}</div></div>` : ""}
<h2>Estratégia</h2>
<div class="field"><div class="label">Público-alvo</div><div class="value">${escapeHtml(campaignData.audience)}</div></div>
<div class="field"><div class="label">Canais</div><div class="value">${campaignData.channels.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join(" ")}</div></div>
<div class="field"><div class="label">Orçamento</div><div class="value">${escapeHtml(campaignData.budget)}</div></div>
${campaignData.uniqueAngle ? `<div class="field"><div class="label">Ângulo Único</div><div class="value">${escapeHtml(campaignData.uniqueAngle)}</div></div>` : ""}
${campaignData.objectionHandling ? `<div class="field"><div class="label">Gestão de Objeções</div><div class="value">${escapeHtml(campaignData.objectionHandling)}</div></div>` : ""}
<h2>Mensagens-chave</h2>
<ul>${campaignData.keyMessages.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
<h2>Copy por Plataforma</h2>
${Object.entries(copyObj).map(([pl, cp]) => `<div class="field"><h3>${escapeHtml(pl)}</h3><div class="value">${escapeHtml(cp)}</div></div>`).join("")}
${campaignData.launchTimeline ? `<h2>Cronograma</h2><div class="field"><div class="value">${escapeHtml(campaignData.launchTimeline)}</div></div>` : ""}
${creativesSection}
<div class="footer">Gerado por IAttom Assist &middot; ${new Date().toLocaleDateString("pt-BR")}</div>
</body></html>`;

    const slug = product.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "campanha";

    void (async () => {
      toast({ description: "Baixando campanha..." });
      await new Promise(r => setTimeout(r, 80));

      const htmlBlob = new Blob([html], { type: "text/html;charset=utf-8" });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      const htmlA = document.createElement("a");
      htmlA.href = htmlUrl;
      htmlA.download = `campanha-${slug}.html`;
      document.body.appendChild(htmlA);
      htmlA.click();
      document.body.removeChild(htmlA);
      URL.revokeObjectURL(htmlUrl);

      const imageConcepts = (creativeResult?.concepts ?? []).filter(c => c.imageBase64);
      if (imageConcepts.length > 0) {
        await new Promise(r => setTimeout(r, 300));
        toast({ description: "Baixando criativos..." });
        for (let i = 0; i < imageConcepts.length; i++) {
          await new Promise(r => setTimeout(r, 200));
          const b64 = imageConcepts[i].imageBase64!;
          const binary = atob(b64);
          const arr = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j);
          const imgBlob = new Blob([arr], { type: "image/png" });
          const imgUrl = URL.createObjectURL(imgBlob);
          const imgA = document.createElement("a");
          imgA.href = imgUrl;
          imgA.download = `criativo-${i + 1}.png`;
          document.body.appendChild(imgA);
          imgA.click();
          document.body.removeChild(imgA);
          URL.revokeObjectURL(imgUrl);
        }
      }

      toast({ description: "Campanha salva e arquivos baixados." });
    })();
  };

  const showResult = (isDone || isRestored) && isCampaignComplete(campaignData);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Construtor de Campanha</p>
        <h2 className="text-2xl font-bold text-white mb-1">Criar Campanha</h2>
        <p className="text-muted-foreground text-sm">Gere uma estratégia completa de campanha com copy criado para cada plataforma.</p>
      </motion.div>

      {isRestored && campaignData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <p className="text-sm text-primary font-medium">Campanha restaurada de Projetos Salvos</p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Nova Campanha
            </button>
          </div>
        </motion.div>
      )}

      {!(isRestored && campaignData) && (
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
      )}

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
                      onClick={handleSaveAndDownload}
                      className="text-xs text-primary/80 hover:text-primary transition-colors flex items-center gap-1 border border-primary/20 hover:border-primary/40 rounded px-2 py-1 bg-primary/5 hover:bg-primary/10"
                    >
                      <Download className="w-3 h-3" /> Salvar/Baixar
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

                {/* Publicação Assistida */}
                {goal && campaignData && (() => {
                  const guide = getPlatformGuide(goal, campaignData);
                  if (!guide) return null;
                  return (
                    <div className="border-t border-white/5 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-primary uppercase tracking-widest font-medium">Publicação Assistida</p>
                        <a
                          href={guide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary/80 hover:text-primary border border-primary/20 hover:border-primary/40 rounded px-2 py-1 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir {guide.name}
                        </a>
                      </div>
                      <div className="bg-[#0a0a0a] border border-primary/10 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-white">{guide.name}</p>
                        <ol className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="text-primary font-bold text-xs shrink-0 mt-0.5 w-4">{i + 1}.</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                            </li>
                          ))}
                        </ol>
                        <p className="text-xs text-muted-foreground/50 italic border-t border-white/5 pt-2">{guide.note}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Criativo da Campanha — inline, mesmo pacote */}
                <CampaignCreativePanel
                  product={product}
                  goal={goal}
                  audience={audience || campaignData.audience}
                  headline={campaignData.headline}
                  uniqueAngle={campaignData.uniqueAngle}
                  instagramCopy={(campaignData.copy as Record<string, string>)?.instagram}
                  channels={campaignData.channels}
                  autoStart={true}
                  onResult={(r) => setCreativeResult(r)}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
