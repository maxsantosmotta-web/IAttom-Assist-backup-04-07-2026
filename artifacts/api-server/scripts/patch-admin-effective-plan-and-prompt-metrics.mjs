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

// ADM -> Atividade: elimina somente as chaves históricas "prompt" e "find_products".
// Preserva "prompts", "product_discovery", "validate_products" e "product_validation".
source = source.replace(
  ".where(isNull(historyTable.deletedAt))\n    .orderBy(desc(historyTable.createdAt))",
  '.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt"), ne(historyTable.module, "find_products")))\n    .orderBy(desc(historyTable.createdAt))',
);

// ADM -> Análises / Visão Geral: a resposta canônica não inclui as séries antigas.
// Preserva as chaves válidas "prompts", "product_discovery" e "product_validation".
const analyticsModuleQuery = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)`;
const analyticsModuleQueryFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(and(
      ne(historyTable.module, "prompt"),
      ne(historyTable.module, "find_products"),
      ne(historyTable.module, "validate_products"),
    ))
    .groupBy(historyTable.module)`;
if (source.includes(analyticsModuleQuery)) {
  source = source.replace(analyticsModuleQuery, analyticsModuleQueryFiltered);
}

for (const marker of [
  'const effectivePlan = u.planSelected ? u.plan : "free";',
  'plan: effectivePlan',
  'credits: u.credits + (u.extraCredits ?? 0)',
  'ne(historyTable.module, "prompt")',
  'ne(historyTable.module, "find_products")',
  'ne(historyTable.module, "validate_products")',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical metric marker missing: ${marker}`);
}

const promptFilterCount = source.split('ne(historyTable.module, "prompt")').length - 1;
const findProductsFilterCount = source.split('ne(historyTable.module, "find_products")').length - 1;
const validateProductsFilterCount = source.split('ne(historyTable.module, "validate_products")').length - 1;

if (promptFilterCount < 2) {
  throw new Error(`Legacy prompt must be filtered in activity and analytics; found ${promptFilterCount} filter(s)`);
}
if (findProductsFilterCount < 2) {
  throw new Error(`Legacy find_products must be filtered in activity and analytics; found ${findProductsFilterCount} filter(s)`);
}
if (validateProductsFilterCount < 1) {
  throw new Error(`Legacy validate_products must be filtered in analytics; found ${validateProductsFilterCount} filter(s)`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin canonical queries exclude legacy prompt and product metric keys while preserving valid series.");
