import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";

interface CreateCampaignInput {
  product: string;
  audience?: string;
  goal?: string;
  mode?: string;
  platforms?: string[];
  budget?: string;
}

export interface CampaignResult {
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  channels: string[];
  budget: string;
  copy: {
    facebook: string;
    instagram: string;
    google: string;
    email: string;
    tiktok: string;
  };
  keyMessages: string[];
  launchTimeline: string;
  uniqueAngle: string;
  objectionHandling: string;
}

const BACKEND_DIGITAL_GOALS = ["Vender na Hotmart", "Vender na Kiwify"];
const BACKEND_PHYSICAL_KEYWORDS = [
  "roupa", "camiseta", "tênis", "sapato", "calçado", "bolsa", "mochila",
  "eletrônico", "celular", "tablet", "garrafa", "utensílio", "cosmético",
  "perfume", "kit", "aparelho", "dispositivo", "equipamento", "alimento",
  "suplemento", "vitamina", "remédio", "skincare", "caderno", "agenda",
  "óculos", "relógio", "acessório", "brinquedo", "produto físico",
];

function isPhysicalProduct(name: string): boolean {
  const lower = name.toLowerCase();
  return BACKEND_PHYSICAL_KEYWORDS.some((k) => lower.includes(k));
}

function detectCampaignMode(mode?: string): "organic" | "paid" {
  if (!mode) return "paid";
  const normalized = mode.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("organico") || normalized.includes("organic")) return "organic";
  return "paid";
}

const ORGANIC_CHANNELS = [
  "Instagram Reels",
  "Instagram Feed",
  "Stories",
  "TikTok orgânico",
  "WhatsApp",
  "YouTube Shorts",
  "Pinterest",
  "Comunidades",
];

const ORGANIC_BUDGET = "Sem investimento em mídia paga — estratégia 100% orgânica";

const PAID_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bFacebook\s*Ads\b/gi, "postagem no Facebook"],
  [/\bMeta\s*Ads\b/gi, "conteúdo orgânico"],
  [/\bInstagram\s*Ads\b/gi, "Reels orgânicos"],
  [/\bGoogle\s*(Search\s*)?Ads\b/gi, "SEO orgânico"],
  [/\bTikTok\s*Ads\b/gi, "TikTok orgânico"],
  [/\bYouTube\s*Ads\b/gi, "YouTube Shorts orgânico"],
  [/\bPinterest\s*Ads\b/gi, "Pinterest orgânico"],
  [/\bROAS\b/gi, "retorno orgânico"],
  [/\bCPC\b/gi, "engajamento"],
  [/\bCPM\b/gi, "alcance orgânico"],
  [/\bCPA\b/gi, "conversão orgânica"],
  [/\bretargeting\b/gi, "reengajamento orgânico"],
  [/\bremarketing\b/gi, "reconexão com audiência"],
  [/\blookalike\b/gi, "público semelhante orgânico"],
  [/\bpixel\b/gi, "engajamento"],
  [/\bpago\b/gi, "orgânico"],
  [/\bmídia\s*paga\b/gi, "conteúdo orgânico"],
  [/\btráfego\s*pago\b/gi, "tráfego orgânico"],
  [/\bcampanha\s*paga\b/gi, "estratégia orgânica"],
  [/\bimpulsionar\b/gi, "publicar organicamente"],
  [/\bimpulsionamento\b/gi, "crescimento orgânico"],
  [/\banúncio(s)?\b/gi, "conteúdo"],
  [/\banunciar\b/gi, "publicar"],
  [/\bads\b/gi, "conteúdo orgânico"],
  [/\bverba\s*de\s*mídia\b/gi, "dedicação de tempo"],
  [/\borçamento\s*de\s*(anúncio|mídia|ads)(s)?\b/gi, "calendário de conteúdo"],
  [/\blanding\s*page\s*pag(a|o)\b/gi, "página orgânica"],
  [/\bescal(a|ar)\s*(com\s*anúncio(s)?|pag(a|o))\b/gi, "crescimento orgânico"],
];

function sanitizeOrganicText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PAID_TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function hardLockOrganicResult(result: CampaignResult): CampaignResult {
  return {
    ...result,
    budget: ORGANIC_BUDGET,
    channels: ORGANIC_CHANNELS,
    headline: sanitizeOrganicText(result.headline),
    subheadline: sanitizeOrganicText(result.subheadline),
    cta: sanitizeOrganicText(result.cta),
    audience: sanitizeOrganicText(result.audience),
    copy: {
      facebook: sanitizeOrganicText(result.copy.facebook),
      instagram: sanitizeOrganicText(result.copy.instagram),
      google: sanitizeOrganicText(result.copy.google),
      email: sanitizeOrganicText(result.copy.email),
      tiktok: sanitizeOrganicText(result.copy.tiktok),
    },
    keyMessages: result.keyMessages.map(sanitizeOrganicText),
    launchTimeline: sanitizeOrganicText(result.launchTimeline),
    uniqueAngle: sanitizeOrganicText(result.uniqueAngle),
    objectionHandling: sanitizeOrganicText(result.objectionHandling),
  };
}

const SHARED_RULES = `IDIOMA: Responda SEMPRE em português brasileiro. Nunca em inglês ou espanhol.

MODO EXECUTIVO — REGRA CENTRAL:
Você é uma ferramenta de IA premium para profissionais. Responda como consultor sênior que cobra R$500/hora: direto, denso, acionável. Zero introdução, zero conclusão, zero enrolação. Cada palavra deve justificar sua existência.

ANTI-REPETIÇÃO:
Nunca repita a mesma palavra-chave ou argumento entre campos diferentes. Cada campo deve ter um ângulo único. Proibido usar as mesmas expressões em copy.facebook, copy.instagram e copy.tiktok. Varie vocabulário, estrutura e gancho.

LIMITES ABSOLUTOS DE CARACTERES (incluindo espaços):
- copy.facebook: máximo 600 caracteres
- copy.instagram: máximo 450 caracteres
- copy.tiktok: máximo 350 caracteres
- copy.email: máximo 400 caracteres
- copy.google: máximo 200 caracteres (formato real: Título 30 chars | Descrição 90 chars)
- headline: máximo 80 caracteres
- subheadline: máximo 120 caracteres
- cta: máximo 50 caracteres
- uniqueAngle: máximo 200 caracteres
- objectionHandling: máximo 250 caracteres
- cada keyMessage: máximo 100 caracteres

CRONOGRAMA — FORMATO OBRIGATÓRIO:
Máximo 4 etapas. Formato fixo: "Semana N → ação concreta". Uma linha por etapa. Sem sub-itens, sem explicações longas.
Exemplo: "Semana 1 → Estrutura e posicionamento\nSemana 2 → Primeiros conteúdos e testes\nSemana 3 → Otimização e consistência\nSemana 4 → Escala e ajustes"

SELEÇÃO INTELIGENTE DE CANAIS:
Analise o produto e objetivo. Selecione APENAS 3-4 canais onde o público realmente está. Não adicione canais por completude — adicione apenas se fizerem sentido real para o negócio. Exemplo: consultoria Instagram → priorize Instagram, WhatsApp, Reels. Não inclua Google, Email ou Pinterest se não houver justificativa clara.

ESTILO DE ESCRITA:
- Bullets em vez de parágrafos quando há mais de 2 itens
- Frases curtas (máximo 15 palavras)
- Verbos no imperativo: "Poste", "Responda", "Teste", "Grave"
- Sem jargão corporativo, sem "estratégia robusta", sem "maximizar resultados"
- Copy deve soar como humano escrevendo para humano, não como relatório

Saída: objeto JSON válido. Sem markdown, sem blocos de código, apenas JSON puro.`;

const ORGANIC_SYSTEM_PROMPT = `Você é um estrategista de marketing orgânico premium para o mercado brasileiro. Especialista em crescimento sem tráfego pago.

${SHARED_RULES}

REGRA ABSOLUTA — MODO ORGÂNICO:
PROIBIDO mencionar: Facebook Ads, Meta Ads, Google Ads, TikTok Ads, ROAS, CPC, CPM, remarketing, retargeting, pixel, lookalike pago, orçamento de anúncios, impulsionamento, campanha paga, tráfego pago, mídia paga, landing page paga.

O campo "budget" DEVE ser: "Sem investimento em mídia paga — estratégia 100% orgânica"
O campo "channels" DEVE conter APENAS 3-4 canais orgânicos prioritários para o produto informado.

Retorne exatamente esta estrutura JSON:
{
  "headline": string (máx. 80 chars — título direto, benefício claro, sem urgência artificial),
  "subheadline": string (máx. 120 chars — reforço do posicionamento orgânico, uma frase),
  "cta": string (máx. 50 chars — ação orgânica: seguir, comentar, salvar, mandar DM),
  "audience": string (máx. 150 chars — público-alvo em 1-2 frases, específico e direto),
  "channels": string[] (3-4 canais orgânicos prioritários para este produto — escolha com critério, não por completude),
  "budget": string (retornar SEMPRE: "Sem investimento em mídia paga — estratégia 100% orgânica"),
  "copy": {
    "facebook": string (máx. 600 chars — postagem orgânica: gancho, storytelling ou prova social, pergunta de engajamento. SEM anúncio ou impulsionamento),
    "instagram": string (máx. 450 chars — legenda para Reels/feed: hook visual, narrativa autêntica, 3-5 hashtags, CTA para salvar ou comentar),
    "google": string (máx. 200 chars — conteúdo para SEO: "Título SEO | Descrição com palavra-chave natural e proposta de valor". SEM Google Ads),
    "email": string (máx. 400 chars — "Assunto: [assunto] | [pré-texto]. [Abertura humana]. [Argumento central]. [CTA único]"),
    "tiktok": string (máx. 350 chars — roteiro: "Hook [2s]: [frase]. Desenvolvimento: [narrativa]. CTA: [ação]". Tom cru e autêntico)
  },
  "keyMessages": string[] (exatamente 3 itens — cada um máx. 100 chars, ângulos diferentes entre si),
  "launchTimeline": string (exatamente 4 linhas, formato: "Semana N → ação concreta". Sem sub-itens. Sem explicações. Apenas execução orgânica),
  "uniqueAngle": string (máx. 200 chars — o que diferencia esta estratégia das demais. Uma frase forte),
  "objectionHandling": string (máx. 250 chars — como neutralizar a principal objeção com conteúdo orgânico, sem ads)
}`;

const PAID_SYSTEM_PROMPT = `Você é um estrategista de marketing de resposta direta premium para o mercado brasileiro. Cada resposta é um plano executável, não um relatório.

${SHARED_RULES}

MODO DE CAMPANHA — adapte TUDO ao modo informado. Padrão: Conversão.

- Iniciante: R$300–800/mês, 2 canais máx (Instagram + WhatsApp), tom acolhedor, foco em primeiras vendas, cronograma 30 dias.
- Baixo orçamento: R$500–1.500/mês, 1-2 canais, sem remarketing complexo, canal com melhor custo por resultado.
- Conversão: R$1.500–5.000/mês, urgência e prova social, funil direto tráfego → venda, canais de alta intenção.
- Viral: UGC + creators, retenção primeiros 3s, TikTok/Reels/YouTube Shorts, gatilho de curiosidade.
- Agressivo: R$5.000–15.000/mês, urgência real, remarketing forte, múltiplos canais, testes A/B, 15-30 dias.
- Premium: posicionamento de valor, sem promoções de preço, canais selecionados, exclusividade.
- Escala: produto validado, lookalike + remarketing pesado, acima R$10.000/mês, expansão em fases.

SELEÇÃO DE CANAIS — OBRIGATÓRIO:
Escolha apenas 3-4 canais que fazem sentido real para o produto e objetivo. Não complete por completude. Uma consultoria de Instagram não precisa de Google Ads. Um e-commerce Shopee não precisa de TikTok se o público não está lá.

Retorne exatamente esta estrutura JSON:
{
  "headline": string (máx. 80 chars — benefício central, impacto imediato),
  "subheadline": string (máx. 120 chars — argumento de apoio, uma frase),
  "cta": string (máx. 50 chars — ação clara e direta),
  "audience": string (máx. 150 chars — quem é, onde está, qual dor tem. 1-2 frases),
  "channels": string[] (3-4 canais reais para este produto/objetivo — com critério, não por completude),
  "budget": string (máx. 80 chars — valor mensal realista. Iniciantes/afiliados: R$300–3.000/mês. Intermediário: R$3.000–10.000/mês. Agressivo: acima R$10.000 só se justificado. Sem estimativas enterprise sem razão),
  "copy": {
    "facebook": string (máx. 600 chars — problema real → argumento de valor → prova social → CTA imediato. Tom: direto, adulto),
    "instagram": string (máx. 450 chars — hook visual → identidade/pertencimento → Reels/Stories → CTA de engajamento. Tom: aspiracional, autêntico),
    "google": string (máx. 200 chars — "Título (máx 30 chars): [título] | Descrição (máx 90 chars): [benefício + CTA]". Alta intenção de compra),
    "email": string (máx. 400 chars — "Assunto: [assunto] | [pré-texto]. [Abertura humana]. [Argumento]. [CTA único]". Tom: pessoal, próximo),
    "tiktok": string (máx. 350 chars — "Hook [2s]: [frase que para scroll]. Desenvolvimento: [narrativa/desafio]. CTA: [ação]". Tom: cru, genuíno)
  },
  "keyMessages": string[] (exatamente 3 itens — cada um máx. 100 chars, cada um com ângulo diferente dos outros dois),
  "launchTimeline": string (exatamente 4 linhas, formato "Semana N → ação concreta". Sem sub-itens. Sem explicações. Direto à execução),
  "uniqueAngle": string (máx. 200 chars — diferencial real desta campanha. Uma frase forte e específica),
  "objectionHandling": string (máx. 250 chars — principal objeção do público + como neutralizar. Direto e acionável)
}

PLATAFORMAS ESPECÍFICAS — quando mencionadas no objetivo:
- Shopee: cupom, frete grátis, avaliações, SEO de listagem, oferta relâmpago.
- Hotmart: autoridade, lançamento, carrinho aberto, webinar, bônus, garantia.
- Kiwify: low ticket, upsell, afiliado, conversão direta.
- WhatsApp: consultivo, follow-up, prova social, urgência real.
- Instagram: Reels como motor, Stories para bastidores e urgência.
- TikTok: hooks de 2s, desafios, UGC, creators.`;

function safeParseJson(raw: string): { success: true; data: unknown } | { success: false; error: string } {
  if (!raw?.trim()) return { success: false, error: "A IA retornou uma resposta vazia." };
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { success: false, error: "A resposta da IA não contém JSON válido." };
  }
  try {
    return { success: true, data: JSON.parse(cleaned.slice(start, end + 1)) };
  } catch {
    return { success: false, error: "Erro ao interpretar a resposta da IA." };
  }
}

function validateCampaignResult(r: CampaignResult): string | null {
  if (!r.headline?.trim()) return "Campo 'manchete' não foi gerado.";
  if (!r.audience?.trim()) return "Campo 'público' não foi gerado.";
  if (!Array.isArray(r.channels) || r.channels.length === 0) return "Campo 'canais' não foi gerado.";
  if (!r.budget?.trim()) return "Campo 'orçamento' não foi gerado.";
  if (!r.copy || typeof r.copy !== "object") return "Campo 'copies' não foi gerado.";
  const copyValues = Object.values(r.copy as Record<string, string>);
  if (copyValues.every((v) => !v?.trim())) return "Os copies de plataforma não foram gerados.";
  if (!Array.isArray(r.keyMessages) || r.keyMessages.length === 0) return "Campo 'mensagens-chave' não foi gerado.";
  if (!r.launchTimeline?.trim()) return "Campo 'cronograma' não foi gerado.";
  return null;
}

export async function streamCreateCampaign(
  params: CreateCampaignInput,
  res: Response,
  clerkUserId: string,
): Promise<void> {
  setupSSE(res);

  if (
    params.goal &&
    BACKEND_DIGITAL_GOALS.includes(params.goal) &&
    isPhysicalProduct(params.product)
  ) {
    sendSSEError(
      res,
      "Produto físico detectado. Hotmart/Kiwify são plataformas voltadas principalmente para produtos digitais. Altere a plataforma ou transforme a oferta em produto digital antes de gerar a campanha.",
    );
    return;
  }

  sendSSE(res, { type: "start" });

  const campaignMode = detectCampaignMode(params.mode);
  const systemPrompt = campaignMode === "organic" ? ORGANIC_SYSTEM_PROMPT : PAID_SYSTEM_PROMPT;

  const userPrompt = campaignMode === "organic"
    ? `Crie uma estratégia de marketing orgânico completa para:
Produto/Marca: "${params.product}"
${params.audience ? `Público-alvo: ${params.audience}` : ""}
${params.goal ? `Objetivo: ${params.goal}` : "Gerar vendas via canais orgânicos"}
${params.platforms?.length ? `Plataformas preferidas: ${params.platforms.join(", ")}` : ""}

IMPORTANTE: Esta é uma estratégia 100% orgânica. Não inclua nenhum tipo de mídia paga, ads ou orçamento de anúncios. Crie copy específico para cada plataforma usando apenas abordagens orgânicas, integralmente em português brasileiro.`
    : `Crie uma campanha de marketing completa para:
Produto/Marca: "${params.product}"
${params.audience ? `Público-alvo: ${params.audience}` : ""}
${params.goal ? `Objetivo da campanha: ${params.goal}` : "Gerar vendas"}
${params.mode ? `Modo da campanha: ${params.mode}` : "Modo da campanha: Conversão"}
${params.platforms?.length ? `Plataformas preferidas: ${params.platforms.join(", ")}` : ""}
${params.budget ? `Orçamento: ${params.budget}` : ""}

Adapte toda a estrutura da campanha ao modo informado. Crie copy específico para cada plataforma, integralmente em português brasileiro.`;

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        sendSSE(res, { type: "chunk", content });
      }
    }

    const parsed = safeParseJson(fullResponse);
    if (!parsed.success) {
      sendSSEError(res, parsed.error);
      return;
    }

    const raw = parsed.data as CampaignResult;
    const validationError = validateCampaignResult(raw);
    if (validationError) {
      sendSSEError(res, `Campanha gerada incompleta: ${validationError} Tente novamente.`);
      return;
    }

    const result = campaignMode === "organic" ? hardLockOrganicResult(raw) : raw;
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: `Campaign created: ${params.product} [${campaignMode}]`, module: "campaign" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}

export async function refineCampaignBlock(
  blockId: string,
  currentContent: string,
  instruction: string,
  campaignContext: string,
  clerkUserId: string,
): Promise<{ refinedContent: string } | { error: string }> {
  const systemPrompt = `Você é um especialista em marketing digital brasileiro. Refine APENAS o bloco especificado de uma campanha existente, seguindo exatamente a instrução do usuário. Responda APENAS com o conteúdo refinado — sem explicações, sem markdown, sem JSON, sem prefixo, sem sufixo. Respeite os limites de caracteres do bloco original.`;

  const userPrompt = `Bloco a refinar: ${blockId}
Conteúdo atual: ${currentContent}
Instrução do usuário: ${instruction}
Contexto da campanha: ${campaignContext}

Retorne APENAS o conteúdo refinado para este bloco. Sem explicações, sem texto extra, sem aspas envolvendo a resposta.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) return { error: "A IA não retornou conteúdo refinado." };

    await logAiUsage({ clerkUserId, action: `Campaign block refined: ${blockId}`, module: "campaign" });
    return { refinedContent: raw.trim() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no refinamento";
    return { error: msg };
  }
}
