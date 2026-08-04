import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

// ADM -> Usuários: o plano comercial exibido deve respeitar a escolha real do cadastro.
// Não altera saldo, histórico, projetos nem o valor persistido em users.plan.
if (!source.includes('const effectivePlan = u.planSelected ? u.plan : "free";')) {
  const usersMapPattern = /(const usersWithCounts = await Promise\.all\(allUsers\.map\(async \(u\) => \{[\s\S]*?const \[\[pc\], \[ac\]\] = await Promise\.all\(\[[\s\S]*?\]\);\n)([\s\S]*?)(\n  \}\)\);)/;
  const usersMapMatch = source.match(usersMapPattern);
  if (!usersMapMatch) throw new Error("Admin users mapping block not found");

  const currentBody = usersMapMatch[2];
  const returnPattern = /\s*(?:const activeSubscriptionStatuses[\s\S]*?)?return \{ \.\.\.u, (?:plan: [^,]+, )?projectCount: pc\.count, actionCount: ac\.count, banned: clerkBannedMap\.get\(u\.clerkId\) \?\? false \};/;
  if (!returnPattern.test(currentBody)) throw new Error("Admin users response row not found");

  const canonicalBody = currentBody.replace(
    returnPattern,
    `\n    const effectivePlan = u.planSelected ? u.plan : "free";\n    return { ...u, plan: effectivePlan, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`,
  );
  source = source.replace(usersMapPattern, `${usersMapMatch[1]}${canonicalBody}${usersMapMatch[3]}`);
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
  'ne(historyTable.module, "prompt")',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical plan/prompt marker missing: ${marker}`);
}

const legacyPromptFilterCount = source.split('ne(historyTable.module, "prompt")').length - 1;
if (legacyPromptFilterCount < 2) {
  throw new Error(`Legacy prompt must be filtered in activity and analytics; found ${legacyPromptFilterCount} filter(s)`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin users now honor planSelected and the legacy prompt series is excluded without merging counts.");
