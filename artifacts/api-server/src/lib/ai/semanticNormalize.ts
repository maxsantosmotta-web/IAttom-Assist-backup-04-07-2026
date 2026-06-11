/**
 * semanticNormalize — camada de correção semântica compartilhada.
 * Aplicada em todos os inputs do usuário ANTES da montagem dos prompts.
 *
 * Ordem das camadas (por palavra, em sequência):
 *   1. Marcas protegidas  — nunca alterar
 *   2. Mapa fixo          — correções determinísticas
 *   3. Contexto obrigatório — palavras ambíguas só corrigem com sinal semântico
 *   4. Similaridade + contexto — edit distance ≤ limiar, validado por contexto
 */

// ─── 1. MARCAS PROTEGIDAS ────────────────────────────────────────────────────
const PROTECTED_BRANDS: Record<string, string> = {
  iattom: "IAttom",
  protegnv: "PROTEGNV",
  hotmart: "Hotmart",
  shopee: "Shopee",
  kiwify: "Kiwify",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  pinterest: "Pinterest",
  mercadolivre: "Mercado Livre",
};

// ─── 2. MAPA FIXO ────────────────────────────────────────────────────────────
const CORRECTIONS: Record<string, string> = {
  // Marketing / negócios
  markting: "marketing",
  marketng: "marketing",
  maketing: "marketing",
  markeitng: "marketing",
  mktg: "marketing",
  // Coach / coaching — variantes inequívocas (sem ambiguidade de marca)
  coalth: "coach",
  coch: "coach",
  cooach: "coach",
  // Empreendedor
  empreendor: "empreendedor",
  // PT-BR — acento ausente
  caminhao: "caminhão",
  gestao: "gestão",
  educacao: "educação",
  nutricao: "nutrição",
  comunicacao: "comunicação",
  producao: "produção",
  negocio: "negócio",
  negocios: "negócios",
  lideranca: "liderança",
  informacao: "informação",
  criacao: "criação",
  solucao: "solução",
  solucoes: "soluções",
  atencao: "atenção",
  situacao: "situação",
  relacao: "relação",
  funcao: "função",
  operacao: "operação",
  conteudo: "conteúdo",
  estrategia: "estratégia",
  estrategias: "estratégias",
  trafego: "tráfego",
  anuncio: "anúncio",
  anuncios: "anúncios",
  configuracao: "configuração",
  integracao: "integração",
  // Marcas — grafia errada → forma canônica
  hotmat: "Hotmart",
  hotmrat: "Hotmart",
  kiwfiy: "Kiwify",
  shope: "Shopee",
};

// ─── 3. CORREÇÕES CONTEXTUAIS ────────────────────────────────────────────────
// Palavras ambíguas que SÓ são corrigidas quando sinais semânticos confirmam o domínio.
// Necessário para casos como "Colt" (marca/modelo) vs. "coach" (área de negócios).
interface ContextEntry {
  words: string[];   // formas incorretas a detectar (lowercase)
  target: string;   // forma correta
  contexts: string[]; // qualquer uma dessas palavras no texto dispara a correção
}

const CONTEXT_ONLY: ContextEntry[] = [
  {
    // formas incorretas de "coach" / "coaching" — ambíguas sem contexto (ex: Colt = carro)
    words: ["colt", "coac", "coah", "coatch", "colting", "coachig", "coachin"],
    target: "coach",
    contexts: [
      // domínio de negócios / desenvolvimento pessoal
      "mentoria", "mentorar", "mentorando",
      "empreendedor", "empreendedorismo", "empreendedora",
      "vendas", "vender", "vendedor",
      "negocio", "negócio", "negocios", "negócios",
      "posicionamento",
      "desenvolvimento", "pessoal", "profissional",
      "lideranca", "liderança", "lider", "líder",
      "carreira", "executivo", "executiva",
      "coaching", "coachee",
      "servico", "serviço", "consultoria",
      // conteineres profissionais / educacionais — qualquer produto que seja um curso ou formação
      "curso", "cursos", "ebook", "faculdade", "treinamento", "treinamentos",
      "instituto", "programa", "programas", "metodo", "método", "academia",
      "formacao", "formação", "workshop", "capacitacao", "capacitação",
      "certificacao", "certificação", "especializacao", "especialização",
      "bootcamp", "imersao", "imersão", "masterclass", "palestra",
    ],
  },
];

// ─── 4. ALVOS DE SIMILARIDADE ────────────────────────────────────────────────
// Correção por proximidade fonética/ortográfica + validação de contexto.
// Apenas para palavras dentro do limiar de edit distance.
interface SimilarityTarget {
  target: string;
  targetLower: string;
  contexts: string[];
}

const SIMILARITY_TARGETS: SimilarityTarget[] = [
  {
    target: "coach",
    targetLower: "coach",
    contexts: [
      // domínio de negócios / desenvolvimento pessoal
      "mentoria", "mentorar", "empreendedor", "empreendedorismo",
      "vendas", "negocio", "negócio", "posicionamento",
      "desenvolvimento", "carreira", "executivo", "coaching",
      // conteineres profissionais / educacionais
      "curso", "cursos", "ebook", "faculdade", "treinamento",
      "instituto", "programa", "metodo", "método", "academia",
      "formacao", "formação", "workshop", "bootcamp", "masterclass",
    ],
  },
  {
    target: "marketing",
    targetLower: "marketing",
    contexts: [
      // domínio de marketing / negócios
      "digital", "vendas", "conteudo", "conteúdo", "redes", "sociais",
      "estrategia", "estratégia", "campanha", "marca", "negocio", "negócio",
      "anuncio", "anúncio", "trafego", "tráfego",
      // conteineres profissionais / educacionais — ex: "Curso de marqueting"
      "curso", "cursos", "ebook", "faculdade", "treinamento",
      "instituto", "programa", "metodo", "método", "academia",
      "formacao", "formação", "workshop", "bootcamp", "masterclass",
    ],
  },
];

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

/** Distância de Levenshtein (dois vetores, memória O(n)). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_: unknown, i: number) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Limiar de edit distance por comprimento da palavra. */
function distanceThreshold(len: number): number {
  return len <= 4 ? 1 : 2;
}

/** Verifica se ao menos um sinal de contexto está presente no texto completo. */
function hasContextSignal(fullText: string, signals: string[]): boolean {
  return signals.some((s) => fullText.includes(s));
}

/**
 * Preserva a capitalização inicial da palavra original na correção.
 * Usado nas camadas contextuais — as correções do mapa fixo e marcas protegidas
 * já definem a capitalização canônica explicitamente.
 */
function preserveLeadingCase(original: string, corrected: string): string {
  if (
    original.length > 0 &&
    corrected.length > 0 &&
    original[0] !== original[0].toLowerCase()
  ) {
    return corrected[0].toUpperCase() + corrected.slice(1);
  }
  return corrected;
}

// ─── CORREÇÃO POR PALAVRA ────────────────────────────────────────────────────

function correctWord(word: string, fullTextLower: string): string {
  const lower = word.toLowerCase();

  // Camada 1 — marcas protegidas
  const brand = PROTECTED_BRANDS[lower];
  if (brand !== undefined) return brand;

  // Camada 2 — mapa fixo
  const fixed = CORRECTIONS[lower];
  if (fixed !== undefined) return fixed;

  // Camada 3 — correção condicional ao contexto
  for (const entry of CONTEXT_ONLY) {
    if (entry.words.includes(lower) && hasContextSignal(fullTextLower, entry.contexts)) {
      return preserveLeadingCase(word, entry.target);
    }
  }

  // Camada 4 — similaridade + contexto (mínimo 4 chars para evitar falsos positivos)
  if (lower.length >= 4) {
    const threshold = distanceThreshold(lower.length);
    for (const st of SIMILARITY_TARGETS) {
      if (lower === st.targetLower) break; // já correto
      const dist = levenshtein(lower, st.targetLower);
      if (dist > 0 && dist <= threshold && hasContextSignal(fullTextLower, st.contexts)) {
        return preserveLeadingCase(word, st.target);
      }
    }
  }

  return word;
}

// ─── EXPORTS PÚBLICOS ─────────────────────────────────────────────────────────

/**
 * Corrige erros de digitação e ortografia no texto de entrada.
 * Aplica marcas protegidas, mapa fixo, contexto e similaridade em sequência.
 * Assinatura mantida: semanticNormalize(input: string): string
 *
 * Exemplos:
 *   "markting digital"              → "marketing digital"
 *   "Mentoria Colt para empreendedores" → "Mentoria Coach para empreendedores"
 *   "Mentoria coatch de vendas"     → "Mentoria coach de vendas"
 *   "Carro Colt"                    → "Carro Colt"   ← sem contexto de negócios
 *   "hotmat"                        → "Hotmart"
 *   "IAttom"                        → "IAttom"
 */
export function semanticNormalize(input: string): string {
  if (!input?.trim()) return input;
  const fullTextLower = input.toLowerCase();
  return input.replace(/[A-Za-zÀ-ÿ]+/g, (word) => correctWord(word, fullTextLower));
}

/**
 * Converte lista de palavras-chave em hashtags formatadas.
 * Remove acentos, minúsculas, prefixo #.
 *
 * Exemplos:
 *   "motivacao mentalidade alta_performance"
 *     → "#motivacao #mentalidade #altaperformance"
 *   "marketingdigital instagram vendas"
 *     → "#marketingdigital #instagram #vendas"
 */
export function normalizeHashtags(text: string): string {
  if (!text?.trim()) return text;
  return text
    .split(/[\s,;|_]+/)
    .map((token) => token.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((token) =>
      "#" +
      token
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase(),
    )
    .filter((t) => t.length > 1)
    .join(" ");
}

/**
 * Normaliza hashtags inline já presentes no texto de output do modelo.
 * Aplicada sobre campos "social" / "tweetThread" em createContent.
 *
 * Exemplo:
 *   "Confira! #Motivação #Alta_Performance" → "Confira! #motivacao #altaperformance"
 */
export function normalizeHashtagsInOutput(text: string): string {
  if (!text?.trim()) return text;
  return text.replace(/#[\wÀ-ÿ_-]+/g, (match) => {
    const tag = match
      .slice(1)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\s-]/g, "")
      .toLowerCase();
    return `#${tag}`;
  });
}
