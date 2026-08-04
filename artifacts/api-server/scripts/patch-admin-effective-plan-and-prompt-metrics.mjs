import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

// ADM -> Usuários: altera somente o plano exibido.
// Preserva integralmente créditos, projetos, histórico e demais campos já montados.
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

// ADM -> Análises / Visão Geral: a resposta canônica não inclui a série antiga.
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
  'const effectivePlan = u.planSelected ? u.plan : "free";',
  'plan: effectivePlan',
  'credits: u.credits + (u.extraCredits ?? 0)',
  'ne(historyTable.module, "prompt")',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical plan/prompt marker missing: ${marker}`);
}

const legacyPromptFilterCount = source.split('ne(historyTable.module, "prompt")').length - 1;
if (legacyPromptFilterCount < 2) {
  throw new Error(`Legacy prompt must be filtered in activity and analytics; found ${legacyPromptFilterCount} filter(s)`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin effective plan applied while preserving balances; legacy prompt remains excluded.");
