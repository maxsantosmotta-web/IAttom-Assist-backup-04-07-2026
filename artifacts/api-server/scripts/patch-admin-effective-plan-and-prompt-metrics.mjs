import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

// ADM -> Usuários: preserva todos os campos e mantém planSelected disponível
// para o frontend distinguir FREE de SEM PLANO.
if (!source.includes('const effectivePlan = u.planSelected ? u.plan : "free";')) {
  const currentRows = [
    "    return { ...u, credits: u.credits + (u.extraCredits ?? 0), projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };",
    "    return { ...u, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };",
  ];

  const currentRow = currentRows.find((row) => source.includes(row));
  if (!currentRow) throw new Error("Admin users response row not found after known build patches");

  const preservedFields = currentRow.includes("credits: u.credits + (u.extraCredits ?? 0)")
    ? "credits: u.credits + (u.extraCredits ?? 0), "
    : "";

  const replacement = `    const effectivePlan = u.planSelected ? u.plan : "free";\n    return { ...u, plan: effectivePlan, ${preservedFields}projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;
  source = source.replace(currentRow, replacement);
}

// ADM -> Atividade: elimina somente a chave histórica singular "prompt".
// A chave válida "prompts" continua intacta.
source = source.replace(
  ".where(isNull(historyTable.deletedAt))\n    .orderBy(desc(historyTable.createdAt))",
  '.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt")))\n    .orderBy(desc(historyTable.createdAt))',
);

// ADM -> Análises / Visão Geral: remove a série antiga sem somar seus 4 registros.
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

// A API entrega o nome final. Todas as telas recebem exatamente Criar Prompt = 31.
const genericFeatureName = '    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),';
const canonicalFeatureName = '    name: r.module === "prompts" ? "Criar Prompt" : r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),';
if (source.includes(genericFeatureName)) {
  source = source.replace(genericFeatureName, canonicalFeatureName);
}

for (const marker of [
  'const effectivePlan = u.planSelected ? u.plan : "free";',
  'plan: effectivePlan',
  'credits: u.credits + (u.extraCredits ?? 0)',
  'ne(historyTable.module, "prompt")',
  'r.module === "prompts" ? "Criar Prompt"',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical plan/prompt marker missing: ${marker}`);
}

const legacyPromptFilterCount = source.split('ne(historyTable.module, "prompt")').length - 1;
if (legacyPromptFilterCount < 2) {
  throw new Error(`Legacy prompt must be filtered in activity and analytics; found ${legacyPromptFilterCount} filter(s)`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin keeps planSelected and returns only Criar Prompt without merging legacy prompt counts.");
