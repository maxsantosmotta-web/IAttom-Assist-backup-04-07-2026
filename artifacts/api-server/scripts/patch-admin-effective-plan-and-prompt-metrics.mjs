import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

// ADM -> Usuários:
// ListAdminUsersResponse.parse remove planSelected do payload porque esse campo
// ainda não existe no schema gerado. A tela precisa dele para distinguir
// SEM PLANO de FREE. Mantemos o plano persistido intacto e devolvemos o objeto
// já montado pela rota, sem alterar saldo, projetos, histórico ou Stripe.
const parsedUsersResponse =
  "  res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: totalRes.count }));";
const directUsersResponse =
  "  res.json({ users: usersWithCounts, total: totalRes.count });";

if (source.includes(parsedUsersResponse)) {
  source = source.replace(parsedUsersResponse, directUsersResponse);
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
  directUsersResponse.trim(),
  'ne(historyTable.module, "prompt")',
]) {
  if (!source.includes(marker)) {
    throw new Error(`Admin plan/prompt canonical marker missing: ${marker}`);
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
  "Admin users preserve planSelected; legacy prompt is excluded without changing stored plans or merging counts.",
);
