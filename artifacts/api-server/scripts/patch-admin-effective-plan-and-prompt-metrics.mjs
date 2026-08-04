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

// ADM -> Atividade: elimina somente as chaves históricas antigas de Prompt e Buscar Produtos.
// Preserva prompts, product_discovery, validate_products, Validate Products e product_validation.
const activityOriginal = `.where(isNull(historyTable.deletedAt))
    .orderBy(desc(historyTable.createdAt))`;
const activityPromptFiltered = `.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt")))
    .orderBy(desc(historyTable.createdAt))`;
const activityLegacyUnderscoreFiltered = `.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt"), ne(historyTable.module, "find_products")))
    .orderBy(desc(historyTable.createdAt))`;
const activityCanonicalFiltered = `.where(and(
      isNull(historyTable.deletedAt),
      ne(historyTable.module, "prompt"),
      ne(historyTable.module, "find_products"),
      ne(historyTable.module, "Find Products"),
    ))
    .orderBy(desc(historyTable.createdAt))`;

if (source.includes(activityOriginal)) {
  source = source.replace(activityOriginal, activityCanonicalFiltered);
} else if (source.includes(activityPromptFiltered)) {
  source = source.replace(activityPromptFiltered, activityCanonicalFiltered);
} else if (source.includes(activityLegacyUnderscoreFiltered)) {
  source = source.replace(activityLegacyUnderscoreFiltered, activityCanonicalFiltered);
}

// ADM -> Análises / Visão Geral: elimina somente as chaves históricas antigas.
// Preserva prompts, product_discovery e product_validation.
const analyticsModuleQuery = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)`;
const analyticsPromptFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)`;
const analyticsLegacyUnderscoreFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(and(
      ne(historyTable.module, "prompt"),
      ne(historyTable.module, "find_products"),
      ne(historyTable.module, "validate_products"),
    ))
    .groupBy(historyTable.module)`;
const analyticsCanonicalFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(and(
      ne(historyTable.module, "prompt"),
      ne(historyTable.module, "find_products"),
      ne(historyTable.module, "validate_products"),
      ne(historyTable.module, "Find Products"),
      ne(historyTable.module, "Validate Products"),
    ))
    .groupBy(historyTable.module)`;

if (source.includes(analyticsModuleQuery)) {
  source = source.replace(analyticsModuleQuery, analyticsCanonicalFiltered);
} else if (source.includes(analyticsPromptFiltered)) {
  source = source.replace(analyticsPromptFiltered, analyticsCanonicalFiltered);
} else if (source.includes(analyticsLegacyUnderscoreFiltered)) {
  source = source.replace(analyticsLegacyUnderscoreFiltered, analyticsCanonicalFiltered);
}

for (const marker of [
  'const effectivePlan = u.planSelected ? u.plan : "free";',
  'plan: effectivePlan',
  'credits: u.credits + (u.extraCredits ?? 0)',
  'ne(historyTable.module, "prompt")',
  'ne(historyTable.module, "Find Products")',
  'ne(historyTable.module, "Validate Products")',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical metric marker missing: ${marker}`);
}

const promptFilterCount = source.split('ne(historyTable.module, "prompt")').length - 1;
const findProductsExactFilterCount = source.split('ne(historyTable.module, "Find Products")').length - 1;
const validateProductsExactFilterCount = source.split('ne(historyTable.module, "Validate Products")').length - 1;

if (promptFilterCount < 2) {
  throw new Error(`Legacy prompt must be filtered in activity and analytics; found ${promptFilterCount} filter(s)`);
}
if (findProductsExactFilterCount < 2) {
  throw new Error(`Legacy Find Products must be filtered in activity and analytics; found ${findProductsExactFilterCount} filter(s)`);
}
if (validateProductsExactFilterCount < 1) {
  throw new Error(`Legacy Validate Products must be filtered in analytics; found ${validateProductsExactFilterCount} filter(s)`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin canonical queries now exclude the actual legacy product module keys while preserving valid series.");

await import("./patch-admin-finance-billing-cycle-display.mjs");
