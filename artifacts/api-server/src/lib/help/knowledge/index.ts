import type { KnowledgeCategory } from "../helpCategories.js";
import { platform } from "./platform.js";
import { journeys } from "./journeys.js";
import { modules } from "./modules.js";
import { integrations } from "./integrations.js";
import { credits } from "./credits.js";
import { billing } from "./billing.js";
import { workspace } from "./workspace.js";
import { roadmap } from "./roadmap.js";
import { classifyHelpIntent, type HelpIntent } from "../intentClassifier.js";

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  topic: string;
  keywords: string[];
  status: "active" | "future" | "unavailable";
  content: string;
  relatedTopics?: string[];
}

// Platform and journeys first — win tie-breaks for broad/goal-oriented queries
const ALL_ENTRIES: KnowledgeEntry[] = [
  ...platform,
  ...journeys,
  ...modules,
  ...integrations,
  ...credits,
  ...billing,
  ...workspace,
  ...roadmap,
];

const entryById = new Map<string, KnowledgeEntry>(
  ALL_ENTRIES.map((e) => [e.id, e])
);

/**
 * Priority entries injected by semantic intent.
 * Order within each array matters — first entries are added first.
 */
const INTENT_ENTRY_MAP: Partial<Record<HelpIntent, string[]>> = {
  START_FROM_ZERO: [
    "platform-onboarding",
    "platform-overview",
    "journey-earn-money",
  ],
  MONETIZE_KNOWLEDGE: [
    "journey-digital-product",
    "journey-course",
    "journey-ebook",
    "create-content",
  ],
  DIGITAL_PRODUCT: [
    "journey-digital-product",
    "integration-hotmart",
    "integration-kiwify",
    "create-campaign",
  ],
  PHYSICAL_PRODUCT: [
    "journey-physical-product",
    "find-products",
    "integration-shopee",
    "integration-mercado-livre",
  ],
  CREATE_CAMPAIGN: [
    "create-campaign",
    "journey-full-campaign",
    "create-content",
    "video-scripts",
  ],
  COMPARE_OPTIONS: [],
  INTEGRATION_PURPOSE: [
    "platform-overview", // IAttom context; specific integration arrives via keyword scoring
  ],
  GROW_BUSINESS: [
    "journey-grow-business",
    "create-campaign",
    "create-content",
  ],
  PLATFORM_USAGE: [
    "platform-overview",
    "platform-onboarding",
  ],
  UNKNOWN: [],
};

function scoreEntry(entry: KnowledgeEntry, text: string): number {
  return entry.keywords.reduce((score, kw) => {
    return text.includes(kw.toLowerCase()) ? score + 1 : score;
  }, 0);
}

function formatEntry(entry: KnowledgeEntry): string {
  const statusNote =
    entry.status === "future"
      ? " [ROADMAP — ainda não disponível]"
      : entry.status === "unavailable"
        ? " [NÃO DISPONÍVEL NO IATTOM ASSIST]"
        : "";
  return `## ${entry.topic}${statusNote}\n${entry.content}`;
}

export interface HistoryMessage {
  role: "assistant" | "user";
  content: string;
}

const COMPARISON_RE =
  /diferen[cç]a|vs\b|versus|comparar|compara[cç][aã]o|qual (é )?melhor|entre .+ e /i;

/**
 * Domain keywords — used to distinguish "no keyword match for a valid
 * IAttom-related query" from "genuinely out of scope".
 * Substrings intentionally kept short to maximise recall.
 */
const DOMAIN_KEYWORDS = [
  // Platform itself
  "iattom", "plataforma", "ferramenta", "assistente",
  // Core actions
  "vender", "venda", "vendas",
  "ganhar", "renda", "dinheiro", "faturar", "lucr", "monetiz",
  "criar", "gerar", "produzir", "lançar",
  "começ", "inici", "empreend",
  "crescer", "escalar", "otimiz", "melhorar",
  // Products / business types
  "produto", "produt",
  "ebook", "e-book",
  "curso", "aula", "treinamento",
  "afiliado", "afiliados", "comissão",
  "infoproduto",
  "negócio", "negócios", "empresa",
  // Marketing
  "campanha", "marketing", "anúncio",
  "conteúdo", "copy",
  "script", "roteiro",
  "imagem", "criativo",
  "estratégia", "funil", "lançamento",
  // Channels / integrations
  "marketplace", "shopee", "tiktok", "instagram", "facebook",
  "mercado livre", "hotmart", "kiwify", "whatsapp",
  // Platform concepts
  "crédito", "plano",
  "projeto", "salvar",
];

function isDomainQuery(text: string): boolean {
  return DOMAIN_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

export interface RetrievalResult {
  context: string;
  outOfScope: boolean;
  intent: HelpIntent;
}

/**
 * Returns the relevant knowledge context and an out-of-scope flag.
 *
 * Retrieval strategy:
 *
 * Layer 1 — Semantic intent classification:
 *   classifyHelpIntent() determines WHAT the user wants to accomplish.
 *   Intent drives priority entry injection, bypassing keyword dependency.
 *
 * Layer 2 — Keyword scoring (support):
 *   Exact keyword matching still runs. Results supplement intent entries.
 *   Query carries 3× weight vs history (current question always wins).
 *   Only USER messages from history are scored (avoids response verbosity).
 *
 * Layer 3 — Merge + dedup:
 *   Intent entries injected first (priority), then keyword-scored additions.
 *   Max 4 intent entries + 2 keyword supplements (4 for comparison queries).
 *
 * Layer 4 — Related topic expansion:
 *   1 related entry added when intent is classified; 3 for UNKNOWN journeys.
 *
 * Layer 5 — Fallback:
 *   Zero matches + domain query → platform-overview + platform-onboarding.
 *   Zero matches + non-domain → outOfScope: true.
 */
export function getRelevantContext(
  query: string,
  history: HistoryMessage[]
): RetrievalResult {
  const queryText = query.toLowerCase();

  // Only user turns — assistant responses are verbose and pollute the score
  const historyText = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  // ── Layer 1: Semantic intent ─────────────────────────────────────────────
  const intent = classifyHelpIntent(queryText);

  // ── Layer 2: Keyword scoring ─────────────────────────────────────────────
  const isComparison =
    COMPARISON_RE.test(query) || intent === "COMPARE_OPTIONS";

  const scored = ALL_ENTRIES
    .map((entry) => {
      const queryScore = scoreEntry(entry, queryText) * 3;
      const histScore = scoreEntry(entry, historyText);
      return { entry, score: queryScore + histScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // ── Layer 3: Merge intent entries + keyword supplements ──────────────────
  const intentIds = INTENT_ENTRY_MAP[intent] ?? [];
  const intentEntries = intentIds
    .map((id) => entryById.get(id))
    .filter((e): e is KnowledgeEntry => e !== undefined)
    .slice(0, 4);

  const includedIds = new Set<string>(intentEntries.map((e) => e.id));
  const topEntries: KnowledgeEntry[] = [...intentEntries];

  // Keyword-scored entries supplement intent entries
  const supplementLimit = isComparison ? 4 : 2;
  let supplementCount = 0;
  for (const { entry } of scored) {
    if (supplementCount >= supplementLimit) break;
    if (!includedIds.has(entry.id)) {
      topEntries.push(entry);
      includedIds.add(entry.id);
      supplementCount++;
    }
  }

  // ── Layer 5: Zero-match fallback ─────────────────────────────────────────
  if (topEntries.length === 0) {
    if (isDomainQuery(queryText)) {
      const fallback = [
        entryById.get("platform-overview"),
        entryById.get("platform-onboarding"),
      ].filter((e): e is KnowledgeEntry => e !== undefined);
      return {
        context: fallback.map(formatEntry).join("\n\n---\n\n"),
        outOfScope: false,
        intent,
      };
    }
    return { context: "", outOfScope: true, intent };
  }

  // ── Layer 4: Related topic expansion ────────────────────────────────────
  const hasJourneyOrPlatform = topEntries.some(
    (e) => e.category === "journeys" || e.category === "platform"
  );
  // When intent is classified, 1 related entry is enough (context already rich).
  // When intent is UNKNOWN, expand up to 3 for journey/platform entries.
  const relatedLimit = hasJourneyOrPlatform
    ? intent !== "UNKNOWN"
      ? 1
      : 3
    : 1;

  const relatedIds = topEntries.flatMap((e) => e.relatedTopics ?? []);
  let added = 0;
  for (const id of relatedIds) {
    if (added >= relatedLimit) break;
    if (includedIds.has(id)) continue;
    const related = entryById.get(id);
    if (related) {
      topEntries.push(related);
      includedIds.add(id);
      added++;
    }
  }

  return {
    context: topEntries.map(formatEntry).join("\n\n---\n\n"),
    outOfScope: false,
    intent,
  };
}
