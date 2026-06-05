import type { KnowledgeCategory } from "../helpCategories.js";
import { modules } from "./modules.js";
import { integrations } from "./integrations.js";
import { credits } from "./credits.js";
import { billing } from "./billing.js";
import { workspace } from "./workspace.js";
import { roadmap } from "./roadmap.js";

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  topic: string;
  keywords: string[];
  status: "active" | "future" | "unavailable";
  content: string;
  relatedTopics?: string[];
}

const ALL_ENTRIES: KnowledgeEntry[] = [
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
  /diferen[cç]a|vs\b|versus|comparar|compara[cç][aã]o|qual (é )?melhor|entre .+ e |x /i;

/**
 * Returns a formatted context string with the most relevant knowledge entries.
 *
 * Retrieval strategy (Etapa 3):
 * - Query carries 3× weight vs history (current question always wins)
 * - Only USER messages from history are used for scoring (avoids pollution from
 *   long assistant responses)
 * - Limit: 4 primary entries normally; 5 for comparison queries
 * - Up to 1 related topic appended after primary entries
 */
export function getRelevantContext(
  query: string,
  history: HistoryMessage[]
): string {
  const queryText = query.toLowerCase();

  // Only user turns — assistant responses are verbose and pollute the score
  const historyText = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const isComparison = COMPARISON_RE.test(query);

  // Score: query = 3× priority, history = 1× support
  const scored = ALL_ENTRIES
    .map((entry) => {
      const queryScore = scoreEntry(entry, queryText) * 3;
      const histScore = scoreEntry(entry, historyText);
      const total = queryScore + histScore;
      return { entry, score: total };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // Comparison queries get an extra slot so both sides land in context
  const primaryLimit = isComparison ? 5 : 4;
  const topEntries = scored.slice(0, primaryLimit).map(({ entry }) => entry);

  // Resolve up to 1 related topic not already included
  const includedIds = new Set(topEntries.map((e) => e.id));
  const relatedIds = topEntries.flatMap((e) => e.relatedTopics ?? []);

  for (const id of relatedIds) {
    if (includedIds.has(id)) continue;
    const related = entryById.get(id);
    if (related) {
      topEntries.push(related);
      break;
    }
  }

  if (topEntries.length === 0) return "";

  return topEntries.map(formatEntry).join("\n\n---\n\n");
}
