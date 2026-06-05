/**
 * Semantic intent classifier for IAttom Help.
 *
 * Classifies user queries by INTENT (what the user wants to accomplish),
 * not by isolated keyword presence. Each intent has phrase signals (2 pts each)
 * and word signals (1 pt each). The highest-scoring intent above its threshold
 * wins. Returns UNKNOWN when no intent clears the threshold — the retrieval
 * engine then applies keyword scoring and domain detection as fallback.
 */

export type HelpIntent =
  | "START_FROM_ZERO"
  | "MONETIZE_KNOWLEDGE"
  | "DIGITAL_PRODUCT"
  | "PHYSICAL_PRODUCT"
  | "CREATE_CAMPAIGN"
  | "COMPARE_OPTIONS"
  | "GROW_BUSINESS"
  | "PLATFORM_USAGE"
  | "INTEGRATION_PURPOSE"
  | "UNKNOWN";

interface IntentSignals {
  /** Substring phrases — 2 points each on match */
  phrases: string[];
  /** Single words/substrings — 1 point each */
  words: string[];
  /** Minimum total score to activate this intent */
  threshold: number;
}

/**
 * Priority order for tie-breaking when two intents score equally.
 * More specific intents rank above general ones.
 */
const INTENT_PRIORITY: HelpIntent[] = [
  "COMPARE_OPTIONS",
  "INTEGRATION_PURPOSE",   // above DIGITAL/PHYSICAL so "para que serve hotmart" wins correctly
  "START_FROM_ZERO",
  "MONETIZE_KNOWLEDGE",
  "DIGITAL_PRODUCT",
  "PHYSICAL_PRODUCT",
  "CREATE_CAMPAIGN",
  "GROW_BUSINESS",
  "PLATFORM_USAGE",
  "UNKNOWN",
];

const SIGNALS: Record<Exclude<HelpIntent, "UNKNOWN">, IntentSignals> = {

  // ─── COMPARE_OPTIONS ─────────────────────────────────────────────────────
  // User wants to choose between two options or understand which is better.
  COMPARE_OPTIONS: {
    phrases: [
      "ou shopee", "ou mercado livre", "ou hotmart", "ou kiwify",
      "ou tiktok", "ou instagram", "ou facebook", "ou whatsapp",
      "qual faz mais sentido", "qual é melhor", "qual o melhor",
      "qual canal", "qual plataforma", "qual integração",
      "onde devo vender", "onde é melhor vender",
      "qual caminho", "vale mais a pena", "o que vale mais",
      "marketplace ou", "shopee ou", "hotmart ou", "kiwify ou",
      "digital ou físico", "físico ou digital",
      "qual a diferença", "diferença entre",
      "qual vale mais", "vale mais",
    ],
    words: ["versus", " vs "],
    threshold: 2,
  },

  // ─── INTEGRATION_PURPOSE ─────────────────────────────────────────────────
  // User wants to understand WHY an integration exists — its purpose, benefit,
  // and how it helps them in practice. NOT a technical configuration question.
  INTEGRATION_PURPOSE: {
    phrases: [
      // Finalidade/utilidade
      "para que serve", "pra que serve",
      "qual a finalidade", "qual é a finalidade",
      "qual a utilidade", "qual é a utilidade",
      "qual o propósito", "qual é o propósito",
      // Por que conectar / por que existe
      "por que conectar", "porque conectar",
      "pra que conectar", "para que conectar",
      "por que existe", "pra que existe", "para que existe",
      "por que essa plataforma", "porque essa plataforma",
      "por que tem essa", "porque tem essa",
      "para que é essa", "pra que é essa",
      // O que ganho / o que muda
      "o que eu ganho", "o que ganho com",
      "o que muda se eu conectar", "o que muda se conectar",
      "o que muda com",
      // Vantagem/benefício
      "qual a vantagem dessa", "qual a vantagem de",
      "qual o benefício", "qual é o benefício",
      "quais os benefícios", "quais são os benefícios",
      "vantagem de ter", "vantagem de conectar",
      "que vantagem",
      // Como me ajuda
      "como me ajuda", "como essa plataforma me ajuda",
      "como o iattom usa", "como o iattom ajuda",
      // "dentro do iattom" (highly specific — signals a purpose question)
      "dentro do iattom", "dentro da plataforma",
      "funciona dentro", "funciona no iattom",
      "no iattom serve", "no iattom funciona",
      "serve dentro", "serve no iattom",
      // "pra que serve essa conexão"
      "pra que serve essa", "para que serve essa",
      "o que faz dentro", "o que serve",
    ],
    words: ["finalidade", "utilidade", "benefício"],
    threshold: 2,
  },

  // ─── START_FROM_ZERO ─────────────────────────────────────────────────────
  // User has no clear starting point — needs orientation and first steps.
  START_FROM_ZERO: {
    phrases: [
      "por onde começo", "por onde começar", "não sei por onde",
      "não sei como começar", "não sei o que fazer",
      "começo do zero", "começando do zero",
      "do zero", "do início",
      "primeiro passo", "primeiros passos", "qual o primeiro passo",
      "preciso de uma direção", "quero uma direção", "que direção",
      "estou perdido", "tô perdido", "estou confuso", "me perdi",
      "nunca fiz isso", "nunca vendi", "nunca trabalhei com",
      "não tenho experiência", "sem experiência",
      "o que fazer primeiro", "como eu começo", "como começo",
      "quero começar do", "quero começar a vender",
      "me indique", "me oriente", "me ajude a começar",
      "não tenho ideia", "não faço ideia",
      "se eu estivesse começando", "se estivesse começando",
      "estou começando", "acabei de começar",
    ],
    words: ["perdido", "desorientado", "iniciante"],
    threshold: 2,
  },

  // ─── MONETIZE_KNOWLEDGE ──────────────────────────────────────────────────
  // User has expertise, experience or a skill and wants to turn it into income.
  MONETIZE_KNOWLEDGE: {
    phrases: [
      "transformar conhecimento", "vender conhecimento", "monetizar conhecimento",
      "transformar experiência", "vender experiência", "monetizar experiência",
      "vender o que sei", "ganhar com o que sei",
      "ganhar com conhecimento", "ganhar com experiência", "ganhar com habilidade",
      "tenho conhecimento", "tenho expertise",
      "minha expertise", "minha experiência", "minha habilidade", "tenho habilidade",
      "sou bom em", "sou boa em", "sou especialista em",
      "pessoas me pedem", "me pedem ajuda", "me pediram ajuda",
      "empacotar experiência", "empacotar conhecimento",
      "compartilhar conhecimento", "ensinar o que sei",
      "o que sei fazer", "vender minha experiência",
      "anos de experiência", "conhecimento em renda",
      "experiência em renda", "experiência em produto",
      "como monetizo isso", "como ganho com isso", "ganho dinheiro com isso",
    ],
    words: ["expertise", "especialidade"],
    threshold: 2,
  },

  // ─── DIGITAL_PRODUCT ─────────────────────────────────────────────────────
  // User wants to create or launch a digital product (course, eBook, infoproduct).
  DIGITAL_PRODUCT: {
    phrases: [
      "produto digital", "criar produto digital", "vender produto digital",
      "lançar algo digital", "lançar online",
      "conteúdo pago", "vender conteúdo pago",
      "vender online sem", "sem estoque", "negócio sem estoque", "negócio digital",
      "infoproduto", "criar infoproduto", "vender infoproduto",
      "hotmart", "kiwify",
      "transformar ideia em produto", "ideia em produto",
      "venda digital", "lançamento digital",
      "lançar algo", "lançar um negócio", "lançar minha",
      "criar um curso online", "criar um curso", "fazer um curso",
      "vender um curso", "criar ebook", "fazer ebook", "vender ebook",
      "lançar um produto",
    ],
    words: [],
    threshold: 2,
  },

  // ─── PHYSICAL_PRODUCT ────────────────────────────────────────────────────
  // User wants to sell physical products on marketplaces (Shopee, Mercado Livre).
  PHYSICAL_PRODUCT: {
    phrases: [
      "produto físico", "vender produto físico", "produtos físicos",
      "vender na shopee", "na shopee",
      "vender no mercado livre", "no mercado livre",
      "trabalhar com marketplace", "vender em marketplace",
      "revender produtos", "revenda de produtos", "quero revender",
      "achar mercadorias", "vender mercadorias",
      "encontrar produto para vender", "achar produto para vender",
      "loja online", "loja virtual",
    ],
    words: ["shopee", "marketplace", "revenda", "mercadoria"],
    threshold: 2,
  },

  // ─── CREATE_CAMPAIGN ─────────────────────────────────────────────────────
  // User wants to market, advertise or improve sales for an existing product.
  CREATE_CAMPAIGN: {
    phrases: [
      "criar campanha", "criar uma campanha", "campanha completa",
      "campanha do zero", "montar campanha", "fazer campanha",
      "quero vender mais", "preciso vender mais",
      "divulgar meu produto", "divulgar produto", "divulgar minha loja",
      "divulgar meu", "divulgar melhor", "divulgar minha",
      "minhas vendas", "melhorar minhas vendas",
      "vendas fracas", "vendas ruins",
      "vendas estão caindo", "vendas estão baixas", "vendas estão fracas",
      "atrair clientes", "conseguir clientes", "conquistar clientes",
      "melhorar minha copy", "minha copy", "escrever copy",
      "criar anúncio", "fazer anúncio",
      "campanha de marketing", "estratégia de marketing",
      "preciso de uma campanha",
      "promover meu produto", "promover produto",
      "campanha que convença", "copy que venda", "texto de venda",
    ],
    words: ["campanha", "anúncio", "divulgar"],
    threshold: 2,
  },

  // ─── GROW_BUSINESS ───────────────────────────────────────────────────────
  // User has an existing business and wants to scale or improve results.
  GROW_BUSINESS: {
    phrases: [
      "crescer meu negócio", "escalar meu negócio", "escalar o negócio",
      "fazer meu negócio crescer", "negócio crescer",
      "melhorar meu negócio", "melhorar o negócio",
      "otimizar negócio", "estratégia de crescimento",
      "mais faturamento", "aumentar faturamento", "faturar mais",
      "resultados melhores", "melhorar resultados",
      "negócio estagnado",
    ],
    words: ["escalar", "faturamento"],
    threshold: 2,
  },

  // ─── PLATFORM_USAGE ──────────────────────────────────────────────────────
  // User wants to understand how the IAttom Assist platform works.
  PLATFORM_USAGE: {
    phrases: [
      "iattom", "iattom assist",
      "como funciona a plataforma", "como usar a plataforma",
      "para que serve a plataforma", "o que é a plataforma",
      "como funciona o iattom", "para que serve o iattom",
      "como usar o iattom",
    ],
    words: [],
    threshold: 2,
  },
};

function scoreIntent(signals: IntentSignals, text: string): number {
  const phraseScore = signals.phrases.reduce(
    (s, p) => (text.includes(p.toLowerCase()) ? s + 2 : s),
    0
  );
  const wordScore = signals.words.reduce(
    (s, w) => (text.includes(w.toLowerCase()) ? s + 1 : s),
    0
  );
  return phraseScore + wordScore;
}

export function classifyHelpIntent(queryText: string): HelpIntent {
  const text = queryText.toLowerCase();

  const candidates = (
    INTENT_PRIORITY.filter(
      (i): i is Exclude<HelpIntent, "UNKNOWN"> => i !== "UNKNOWN"
    ) as Exclude<HelpIntent, "UNKNOWN">[]
  )
    .map((intent) => ({ intent, score: scoreIntent(SIGNALS[intent], text) }))
    .filter(({ intent, score }) => score >= SIGNALS[intent].threshold);

  if (candidates.length === 0) return "UNKNOWN";

  // Highest score wins; INTENT_PRIORITY order already determines ties
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].intent;
}
