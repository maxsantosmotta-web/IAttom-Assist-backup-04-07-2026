import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

// ADM -> Usuários:
// A preservação de planSelected já é feita por patch-admin-active-users-response-guard.mjs.
// Este script não altera mais a resposta de usuários; apenas valida que o campo continuará
// disponível para o frontend distinguir SEM PLANO de FREE, sem tocar em saldo, projetos,
// histórico, Stripe ou no plano persistido.
const planSelectedMarker =
  "planSelected: Boolean(visibleActiveUsers[index]?.planSelected)";
if (!source.includes(planSelectedMarker)) {
  throw new Error(
    "Admin users response no longer preserves planSelected after active-user guard",
  );
}

// ADM -> Atividade: elimina somente a chave histórica singular "prompt".
// A chave válida "prompts" continua intacta.
const activityQuery =
  ".where(isNull(historyTable.deletedAt))\n    .orderBy(desc(historyTable.createdAt))";
const activityQueryFiltered =
  '.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt")))\n    .orderBy(desc(historyTable.createdAt))';

if (source.includes(activityQuery)) {
  source = source.replace(activityQuery, activityQueryFiltered);
}

// ADM -> Análises / Visão Geral: exclui apenas a série antiga "prompt".
// A chave válida "prompts" permanece com sua contagem original.
const analyticsModuleQuery = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)`;
const analyticsModuleQueryFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)`;

if (source.includes(analyticsModuleQuery)) {
  source = source.replace(analyticsModuleQuery, analyticsModuleQueryFiltered);
}

for (const marker of [
  planSelectedMarker,
  'ne(historyTable.module, "prompt")',
]) {
  if (!source.includes(marker)) {
    throw new Error(`Admin canonical marker missing: ${marker}`);
  }
}

const legacyPromptFilterCount =
  source.split('ne(historyTable.module, "prompt")').length - 1;
if (legacyPromptFilterCount < 2) {
  throw new Error(
    `Legacy prompt must be filtered in activity and analytics; found ${legacyPromptFilterCount} filter(s)`,
  );
}

fs.writeFileSync(adminPath, source);
console.log(
  "Admin user response remains intact with planSelected; legacy prompt is excluded without merging counts.",
);
