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
  productType?: string;
}

interface CampaignPlatformField {
  key: string;
  label: string;
  value: string;
}

interface CampaignCreativeBriefing {
  produto: string;
  objetivo: string;
  plataforma: string;
  publico: string;
  promessa: string;
  dor: string;
  beneficio: string;
  tom: string;
  cta: string;
  restricoes: string;
}

export interface CampaignResult {
  campaignTitle?: string;
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  channels: string[];
  budget: string;
  copy: Record<string, string>;
  keyMessages: string[];
  launchTimeline: string;
  uniqueAngle: string;
  objectionHandling: string;
  platform?: string;
  platformFields?: CampaignPlatformField[];
  creativeBriefing?: CampaignCreativeBriefing;
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

function detectGoalPlatform(goal?: string): string {
  if (!goal) return "generic";
  const lower = goal.toLowerCase();
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("tiktok")) return "tiktok";
  if (lower.includes("facebook")) return "facebook";
  if (lower.includes("shopee")) return "shopee";
  if (lower.includes("mercado livre")) return "mercado_livre";
  if (lower.includes("hotmart")) return "hotmart";
  if (lower.includes("kiwify")) return "kiwify";
  if (lower.includes("whatsapp")) return "whatsapp";
  return "generic";
}

function buildPlatformFieldsSpec(platform: string): string {
  switch (platform) {
    case "mercado_livre":
      return `"platformFields": [
    {"key": "titulo", "label": "Título do Anúncio", "value": string (OBRIGATÓRIO: máx 60 chars — palavras-chave de busca no início, nome do produto e diferencial principal. Ex: "Kit Suplemento Whey + Creatina 2kg — Entrega Rápida")},
    {"key": "categoria", "label": "Categoria Sugerida", "value": string (categoria exata do Mercado Livre para este produto. Ex: "Suplementos e Vitaminas > Proteínas")},
    {"key": "caracteristicas", "label": "Características do Produto", "value": string (especificações técnicas relevantes, uma por linha usando \\n. Ex: "Material: Aço inox\\nCapacidade: 500ml\\nGarantia: 12 meses")},
    {"key": "descricao", "label": "Descrição", "value": string (máx 400 chars — o que é, para que serve, principais especificações, diferencial de compra. Tom: informativo e direto)},
    {"key": "estrategia_preco", "label": "Estratégia de Preço", "value": string (posicionamento competitivo: preço sugerido, parcelamento ideal, condição que aumenta conversão como Frete Grátis, promoção relâmpago)},
    {"key": "cta", "label": "CTA", "value": string (máx 50 chars — ex: "Compre agora com Frete Grátis", "Aproveite a oferta hoje")}
  ]`;
    case "shopee":
      return `"platformFields": [
    {"key": "nome_produto", "label": "Nome do Produto", "value": string (OBRIGATÓRIO: máx 120 chars — palavras-chave relevantes para busca interna Shopee, modelo, especificação principal)},
    {"key": "categoria", "label": "Categoria Sugerida", "value": string (categoria Shopee mais adequada para este produto)},
    {"key": "descricao", "label": "Descrição do Produto", "value": string (máx 600 chars — detalhe de uso, diferenciais, o que vem na embalagem, especificações técnicas. Tom: claro e descritivo)},
    {"key": "estrategia_oferta", "label": "Estratégia de Oferta", "value": string (máx 200 chars — cupom de desconto, frete grátis, Oferta Relâmpago, pontos de avaliação para subir no ranking, urgência real)},
    {"key": "variacoes", "label": "Variações Sugeridas", "value": string (variações de cor, tamanho ou modelo se aplicável ao produto. Se produto único, escrever "Produto sem variações")}
  ]`;
    case "facebook":
      return `"platformFields": [
    {"key": "texto_principal", "label": "Texto Principal", "value": string (OBRIGATÓRIO: máx 600 chars — problema real → argumento de valor → prova social → CTA. Tom: direto, adulto, sem jargão corporativo)},
    {"key": "headline", "label": "Headline do Anúncio", "value": string (OBRIGATÓRIO: máx 40 chars — benefício central, impacto imediato)},
    {"key": "descricao_link", "label": "Descrição do Link", "value": string (máx 30 chars — reforço da oferta ou do CTA. Ex: "Acesso imediato garantido")},
    {"key": "cta", "label": "Botão CTA", "value": string (máx 30 chars — ex: "Comprar agora", "Saiba mais", "Inscreva-se")}
  ]`;
    case "instagram":
      return `"platformFields": [
    {"key": "legenda", "label": "Legenda", "value": string (OBRIGATÓRIO: máx 450 chars — hook visual forte nas 2 primeiras linhas para parar o scroll, narrativa autêntica, CTA para salvar, comentar ou mandar DM)},
    {"key": "cta", "label": "CTA", "value": string (OBRIGATÓRIO: máx 50 chars — ação clara para legenda e Stories. Ex: "Comente QUERO para receber o link")},
    {"key": "hashtags", "label": "Hashtags", "value": string (5-7 hashtags relevantes separados por espaço, sem # na resposta. Ex: "empreendedorismo negociosonline vendasonline")}
  ]`;
    case "tiktok":
      return `"platformFields": [
    {"key": "hook", "label": "Hook (primeiros 2 segundos)", "value": string (OBRIGATÓRIO: máx 80 chars — frase que para o scroll imediatamente. Curiosidade, contraste ou dado surpreendente. Ex: "Você sabia que 90% das pessoas fazem isso errado?")},
    {"key": "texto_principal", "label": "Legenda do Vídeo", "value": string (OBRIGATÓRIO: máx 350 chars — desenvolvimento da narrativa após o hook, CTA orgânico no final)},
    {"key": "cta", "label": "CTA", "value": string (OBRIGATÓRIO: máx 50 chars — ação oral para o vídeo ou em tela. Ex: "Segue pra ver mais dicas como essa")},
    {"key": "hashtags", "label": "Hashtags", "value": string (3-7 hashtags TikTok relevantes separados por espaço, sem # na resposta)}
  ]`;
    case "hotmart":
      return `"platformFields": [
    {"key": "nome_produto", "label": "Nome do Produto", "value": string (nome claro e vendável do produto digital. Ex: "Método Vendas Automáticas 2.0")},
    {"key": "headline", "label": "Headline da Página de Vendas", "value": string (OBRIGATÓRIO: máx 80 chars — promessa de transformação direta e clara para o público)},
    {"key": "subheadline", "label": "Subheadline", "value": string (OBRIGATÓRIO: máx 120 chars — para quem é, o que entrega concretamente e resultado esperado)},
    {"key": "descricao_oferta", "label": "Descrição da Oferta", "value": string (copy principal do produto: problema que resolve, como entrega, diferencial frente à concorrência)},
    {"key": "beneficios", "label": "Benefícios", "value": string (4-6 benefícios concretos separados por \\n, foco em transformação e resultado tangível do aluno)},
    {"key": "bonus", "label": "Bônus", "value": string (bônus incluídos na compra: nome do bônus, o que entrega e valor percebido de cada um)},
    {"key": "garantia", "label": "Garantia", "value": string (prazo de garantia em dias, condição e como funciona o reembolso. Ex: "Garantia incondicional de 7 dias — peça o reembolso sem precisar se justificar")},
    {"key": "cta", "label": "Botão CTA", "value": string (OBRIGATÓRIO: máx 50 chars — ex: "Quero acesso agora", "Garantir minha vaga", "Começar com desconto")}
  ]`;
    case "kiwify":
      return `"platformFields": [
    {"key": "nome_produto", "label": "Nome do Produto", "value": string (nome do produto digital, direto e vendável. Indica o resultado principal)},
    {"key": "headline", "label": "Headline", "value": string (OBRIGATÓRIO: máx 80 chars — oferta direta e benefício principal. Nada de fluff)},
    {"key": "subheadline", "label": "Subheadline", "value": string (OBRIGATÓRIO: máx 120 chars — valor entregue e para quem é, em uma frase densa)},
    {"key": "descricao_oferta", "label": "Descrição da Oferta", "value": string (máx 250 chars — valor entregue, entrega imediata, garantia. Denso e sem rodeios)},
    {"key": "urgencia", "label": "Urgência / Escassez", "value": string (OBRIGATÓRIO: máx 100 chars — elemento real e acionável de urgência ou escassez. Ex: "Desconto de 40% disponível só hoje")},
    {"key": "cta", "label": "Botão CTA", "value": string (OBRIGATÓRIO: máx 50 chars — ex: "Acesse por apenas R$X", "Comprar agora", "Garantir acesso")}
  ]`;
    case "whatsapp":
      return `"platformFields": [
    {"key": "abordagem_inicial", "label": "Abordagem Inicial", "value": string (OBRIGATÓRIO: máx 200 chars — primeira mensagem consultiva e pessoal, sem spam, quebra de gelo natural. Tom próximo, não corporativo)},
    {"key": "mensagem_valor", "label": "Mensagem de Valor", "value": string (OBRIGATÓRIO: máx 300 chars — acompanhamento com valor entregue, prova social e contextualização do produto)},
    {"key": "cta", "label": "CTA Conversacional", "value": string (máx 80 chars — convite para continuar a conversa. Natural e não invasivo)}
  ]`;
    default:
      return `"platformFields": [
    {"key": "copy_principal", "label": "Copy Principal", "value": string (OBRIGATÓRIO: máx 500 chars — copy adaptado ao objetivo informado, direto e acionável)},
    {"key": "cta", "label": "CTA", "value": string (OBRIGATÓRIO: máx 50 chars — ação clara e direta)}
  ]`;
  }
}

function buildCopySchema(platform: string, isOrganic: boolean): string {
  switch (platform) {
    case "instagram":
      return `"copy": {
    "legenda": string (máx. 450 chars — hook visual, narrativa autêntica${isOrganic ? ", 3-5 hashtags" : ""}, CTA para salvar ou comentar),
    "cta": string (máx. 50 chars — ação clara para legenda e Stories),
    "hashtags": string (5-7 hashtags relevantes separados por espaço, sem # na resposta)
  }`;
    case "facebook":
      return `"copy": {
    "facebook": string (máx. 600 chars — ${isOrganic ? "postagem orgânica: gancho, storytelling ou prova social, pergunta de engajamento" : "problema real → argumento de valor → prova social → CTA imediato. Tom: direto, adulto"}),
    "cta": string (máx. 50 chars)
  }`;
    case "tiktok":
      return `"copy": {
    "hook": string (máx. 80 chars — frase que para o scroll nos primeiros 2 segundos),
    "legenda": string (máx. 350 chars — ${isOrganic ? "narrativa autêntica, hashtags TikTok, CTA orgânico" : "desenvolvimento da narrativa após o hook, CTA"}),
    "cta": string (máx. 50 chars — ação oral ou em tela)
  }`;
    case "mercado_livre":
      return `"copy": {
    "titulo": string (máx. 60 chars — palavras-chave de busca no início, nome do produto e diferencial principal),
    "beneficios": string (3-4 benefícios principais em linhas separadas — ex: "Entrega rápida\\nGarantia 12 meses"),
    "descricao": string (máx. 400 chars — descrição completa: o que é, para que serve, especificações principais),
    "cta": string (máx. 50 chars — ex: Compre agora, Adicione ao carrinho, Aproveite a oferta)
  }`;
    case "shopee":
      return `"copy": {
    "titulo": string (máx. 120 chars — título de listagem com palavras-chave relevantes para busca interna),
    "beneficios": string (3-4 benefícios principais do produto em linhas separadas),
    "oferta": string (máx. 200 chars — estratégia de oferta: cupom, frete grátis, Oferta Relâmpago, avaliações, urgência)
  }`;
    case "hotmart":
      return `"copy": {
    "headline": string (máx. 80 chars — headline da página de vendas, promessa de transformação direta),
    "subheadline": string (máx. 120 chars — para quem é, o que entrega, resultado esperado),
    "cta": string (máx. 50 chars — ex: Quero acesso agora, Garantir minha vaga, Comprar com desconto),
    "objecoes": string (máx. 250 chars — principal objeção do público e como neutralizar com garantia, bônus ou prova social)
  }`;
    case "kiwify":
      return `"copy": {
    "headline": string (máx. 80 chars — oferta direta e benefício principal),
    "cta": string (máx. 50 chars — ex: Acesse por apenas R$X, Comprar agora, Garantir acesso),
    "oferta": string (máx. 150 chars — valor entregue, entrega imediata e garantia em uma frase densa),
    "urgencia": string (máx. 100 chars — elemento de urgência ou escassez real e acionável)
  }`;
    case "whatsapp":
      return `"copy": {
    "abordagem": string (máx. 200 chars — primeira mensagem consultiva, pessoal e sem spam, quebra de gelo natural),
    "mensagem": string (máx. 300 chars — mensagem de acompanhamento com valor entregue, prova social e contextualização do produto),
    "cta": string (máx. 80 chars — convite para continuar a conversa, natural e não invasivo)
  }`;
    default:
      return `"copy": {
    "principal": string (máx. 500 chars — copy principal da campanha adaptado ao objetivo),
    "cta": string (máx. 50 chars)
  }`;
  }
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
  const copySanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.copy)) {
    copySanitized[k] = sanitizeOrganicText(v);
  }
  const platformFieldsSanitized = result.platformFields?.map((f) => ({
    ...f,
    value: sanitizeOrganicText(f.value),
  }));
  return {
    ...result,
    budget: ORGANIC_BUDGET,
    channels: ORGANIC_CHANNELS,
    headline: sanitizeOrganicText(result.headline),
    subheadline: sanitizeOrganicText(result.subheadline),
    cta: sanitizeOrganicText(result.cta),
    audience: sanitizeOrganicText(result.audience),
    copy: copySanitized,
    keyMessages: result.keyMessages.map(sanitizeOrganicText),
    launchTimeline: sanitizeOrganicText(result.launchTimeline),
    uniqueAngle: sanitizeOrganicText(result.uniqueAngle),
    objectionHandling: sanitizeOrganicText(result.objectionHandling),
    platformFields: platformFieldsSanitized,
  };
}

const SHARED_RULES = `IDIOMA: Responda SEMPRE em português brasileiro. Nunca em inglês ou espanhol.

MODO EXECUTIVO — REGRA CENTRAL:
Você é uma ferramenta de IA premium para profissionais. Responda como consultor sênior que cobra R$500/hora: direto, denso, acionável. Zero introdução, zero conclusão, zero enrolação. Cada palavra deve justificar sua existência.

ANTI-REPETIÇÃO:
Nunca repita a mesma palavra-chave ou argumento entre campos diferentes. Cada campo deve ter um ângulo único.

LIMITES ABSOLUTOS DE CARACTERES (incluindo espaços):
- headline: máximo 80 caracteres
- subheadline: máximo 120 caracteres
- cta: máximo 50 caracteres
- uniqueAngle: máximo 200 caracteres
- objectionHandling: máximo 250 caracteres
- cada keyMessage: máximo 100 caracteres

CRONOGRAMA — FORMATO OBRIGATÓRIO:
Máximo 4 etapas. Formato fixo: "Semana N → ação concreta". Uma linha por etapa. Sem sub-itens, sem explicações longas.

SELEÇÃO INTELIGENTE DE CANAIS:
Selecione APENAS 3-4 canais onde o público realmente está para este produto e objetivo específico. Não adicione canais por completude.

ESTILO DE ESCRITA:
- Frases curtas (máximo 15 palavras)
- Verbos no imperativo quando aplicável
- Sem jargão corporativo

Saída: objeto JSON válido. Sem markdown, sem blocos de código, apenas JSON puro.`;

const CREATIVE_BRIEFING_SCHEMA = `"creativeBriefing": {
    "produto": string (nome completo do produto ou marca),
    "objetivo": string (objetivo específico da campanha em 1 frase),
    "plataforma": string (plataforma alvo: instagram/facebook/tiktok/mercado_livre/shopee/hotmart/kiwify/whatsapp),
    "publico": string (público-alvo específico em 1-2 frases — idade, perfil, comportamento),
    "promessa": string (promessa principal de valor — o que o produto entrega de concreto),
    "dor": string (dor ou problema principal que o produto resolve),
    "beneficio": string (principal benefício tangível para o público),
    "tom": string (tom de voz desta campanha: ex "direto e confiante", "empático e explicativo", "próximo e entusiasmado"),
    "cta": string (CTA principal desta campanha),
    "restricoes": string (restrições relevantes: prazo, público restrito, garantia específica, ou "Nenhuma" se não houver)
  }`;

function buildSystemPrompt(platform: string, isOrganic: boolean): string {
  const copySchema = buildCopySchema(platform, isOrganic);
  const platformFieldsSpec = buildPlatformFieldsSpec(platform);

  const modeIntro = isOrganic
    ? `Você é um estrategista de marketing orgânico premium para o mercado brasileiro. Especialista em crescimento sem tráfego pago.

REGRA ABSOLUTA — MODO ORGÂNICO:
PROIBIDO mencionar: Facebook Ads, Meta Ads, Google Ads, TikTok Ads, ROAS, CPC, CPM, remarketing, retargeting, pixel, lookalike pago, orçamento de anúncios, impulsionamento, campanha paga, tráfego pago, mídia paga.

O campo "budget" DEVE ser: "Sem investimento em mídia paga — estratégia 100% orgânica"
O campo "channels" DEVE conter APENAS 3-4 canais orgânicos prioritários para o produto informado.`
    : `Você é um estrategista de marketing de resposta direta premium para o mercado brasileiro. Cada resposta é um plano executável, não um relatório.

MODO DE CAMPANHA — adapte TUDO ao modo informado. Padrão: Conversão.

- Iniciante: R$300–800/mês, 2 canais máx, tom acolhedor, foco em primeiras vendas.
- Baixo orçamento: R$500–1.500/mês, 1-2 canais, canal com melhor custo por resultado.
- Conversão: R$1.500–5.000/mês, urgência e prova social, funil direto tráfego → venda.
- Viral: UGC + creators, retenção primeiros 3s, TikTok/Reels/YouTube Shorts.
- Agressivo: R$5.000–15.000/mês, urgência real, remarketing forte, múltiplos canais.
- Premium: posicionamento de valor, sem promoções de preço, exclusividade.
- Escala: produto validado, lookalike + remarketing pesado, acima R$10.000/mês.`;

  return `${modeIntro}

${SHARED_RULES}

Retorne exatamente esta estrutura JSON:
{
  "platform": string (chave da plataforma: instagram/facebook/tiktok/mercado_livre/shopee/hotmart/kiwify/whatsapp/generic),
  ${platformFieldsSpec},
  ${CREATIVE_BRIEFING_SCHEMA},
  "headline": string (máx. 80 chars — ${isOrganic ? "título direto, benefício claro" : "benefício central, impacto imediato"}),
  "subheadline": string (máx. 120 chars — reforço do posicionamento, uma frase),
  "cta": string (máx. 50 chars — ${isOrganic ? "ação orgânica: seguir, comentar, salvar, mandar DM" : "ação clara e direta"}),
  "audience": string (máx. 150 chars — público-alvo em 1-2 frases, específico e direto),
  "channels": string[] (3-4 canais ${isOrganic ? "orgânicos" : "reais"} prioritários para este produto),
  "budget": string (${isOrganic ? 'retornar SEMPRE: "Sem investimento em mídia paga — estratégia 100% orgânica"' : "máx. 80 chars — valor mensal realista para o modo informado"}),
  ${copySchema},
  "keyMessages": string[] (exatamente 3 itens — cada um máx. 100 chars, ângulos diferentes entre si),
  "launchTimeline": string (exatamente 4 linhas, formato: "Semana N → ação concreta". Sem sub-itens),
  "uniqueAngle": string (máx. 200 chars — diferencial real desta campanha, uma frase forte),
  "objectionHandling": string (máx. 250 chars — principal objeção do público + como neutralizar. Direto e acionável)
}`;
}

function safeParseJson(raw: string): { success: true; data: unknown } | { success: false; error: string } {
  if (!raw?.trim()) return { success: false, error: "A IA retornou uma resposta vazia." };
  try { return { success: true, data: JSON.parse(raw.trim()) }; } catch { /* continue */ }
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return { success: true, data: JSON.parse(cleaned) }; } catch { /* continue */ }
  const cs = cleaned.indexOf("{");
  const ce = cleaned.lastIndexOf("}");
  if (cs !== -1 && ce !== -1 && ce > cs) {
    try { return { success: true, data: JSON.parse(cleaned.slice(cs, ce + 1)) }; } catch { /* continue */ }
  }
  const rs = raw.indexOf("{");
  const re = raw.lastIndexOf("}");
  if (rs !== -1 && re !== -1 && re > rs) {
    try { return { success: true, data: JSON.parse(raw.slice(rs, re + 1)) }; } catch { /* continue */ }
  }
  return { success: false, error: "Erro ao interpretar a resposta da IA. Tente novamente." };
}

function validateCampaignResult(r: CampaignResult): string | null {
  if (!r.headline?.trim() && (!r.platformFields || r.platformFields.length === 0)) {
    return "Campos da campanha não foram gerados.";
  }
  if (r.platformFields && r.platformFields.length > 0) {
    const hasValues = r.platformFields.some((f) => f.value?.trim());
    if (!hasValues) return "Os campos da plataforma não foram preenchidos.";
  } else {
    if (!r.headline?.trim()) return "Campo 'manchete' não foi gerado.";
    if (!r.audience?.trim()) return "Campo 'público' não foi gerado.";
    if (!Array.isArray(r.channels) || r.channels.length === 0) return "Campo 'canais' não foi gerado.";
    if (!r.budget?.trim()) return "Campo 'orçamento' não foi gerado.";
    if (!r.copy || typeof r.copy !== "object") return "Campo 'copy' não foi gerado.";
    const copyValues = Object.values(r.copy as Record<string, string>);
    if (copyValues.every((v) => !v?.trim())) return "Os textos de plataforma não foram gerados.";
    if (!Array.isArray(r.keyMessages) || r.keyMessages.length === 0) return "Campo 'mensagens-chave' não foi gerado.";
    if (!r.launchTimeline?.trim()) return "Campo 'cronograma' não foi gerado.";
  }
  return null;
}

export async function streamCreateCampaign(
  params: CreateCampaignInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
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
  const platform = detectGoalPlatform(params.goal);
  const isOrganic = campaignMode === "organic";
  const systemPrompt = buildSystemPrompt(platform, isOrganic);

  const userPrompt = isOrganic
    ? `Crie uma estratégia de marketing orgânico completa para:
Produto/Marca: "${params.product}"
${params.productType ? `Tipo de produto: ${params.productType} — adapte linguagem, canais, copy e abordagem para este tipo. Digital: autoridade, conteúdo educativo, entrega imediata. Físico: apelo sensorial, qualidade tangível, experiência de uso. Serviço: confiança, processo, resultado concreto, prova social.` : ""}
${params.audience ? `Público-alvo: ${params.audience}` : ""}
${params.goal ? `Objetivo: ${params.goal}` : "Gerar vendas via canais orgânicos"}
${params.platforms?.length ? `Plataformas preferidas: ${params.platforms.join(", ")}` : ""}

Esta é uma estratégia 100% orgânica. Não inclua nenhum tipo de mídia paga, ads ou orçamento de anúncios.
Gere os campos de "platformFields" na ordem exata em que o usuário os preencheria na plataforma escolhida.
Responda integralmente em português brasileiro.`
    : `Crie uma campanha de marketing completa para:
Produto/Marca: "${params.product}"
${params.productType ? `Tipo de produto: ${params.productType} — adapte linguagem, canais, copy e abordagem para este tipo. Digital: urgência de acesso, transformação, resultados, funil direto. Físico: apelo visual, qualidade tangível, entrega, experiência de uso. Serviço: credibilidade, processo, resultado concreto, cases de sucesso.` : ""}
${params.audience ? `Público-alvo: ${params.audience}` : ""}
${params.goal ? `Objetivo da campanha: ${params.goal}` : "Gerar vendas"}
${params.mode ? `Modo da campanha: ${params.mode}` : "Modo da campanha: Conversão"}
${params.platforms?.length ? `Plataformas preferidas: ${params.platforms.join(", ")}` : ""}
${params.budget ? `Orçamento: ${params.budget}` : ""}

Adapte toda a estrutura ao modo e tipo de produto informados.
Gere os campos de "platformFields" na ordem exata em que o usuário os preencheria na plataforma escolhida.
Responda integralmente em português brasileiro.`;

  const MAX_ATTEMPTS = 2;
  const FALLBACK_MSG = "Não consegui gerar a campanha completa desta vez. Tente novamente.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 5000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        stream: false,
      }, { signal });

      const rawText = response.choices[0]?.message?.content ?? "";

      const parsed = safeParseJson(rawText);
      if (!parsed.success) {
        continue;
      }

      const raw = parsed.data as CampaignResult;
      const validationError = validateCampaignResult(raw);
      if (validationError) {
        continue;
      }

      const result = isOrganic ? hardLockOrganicResult(raw) : raw;
      sendSSE(res, { type: "result", data: result });
      await logAiUsage({ clerkUserId, action: `Campanha criada: ${params.product}`, module: "campaign" });
      sendSSEDone(res);
      return;
    } catch {
      // transient API/network error — retry on next attempt
    }
  }

  sendSSEError(res, FALLBACK_MSG);
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

    await logAiUsage({ clerkUserId, action: `Bloco de campanha refinado: ${blockId}`, module: "campaign" });
    return { refinedContent: raw.trim() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no refinamento";
    return { error: msg };
  }
}
