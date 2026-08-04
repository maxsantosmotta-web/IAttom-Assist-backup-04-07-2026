import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

const originalUserRow = `    return { ...u, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;
const previousEffectiveRow = `    const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);
    const effectivePlan = u.plan !== "free" && !activeSubscriptionStatuses.has(u.stripeSubscriptionStatus ?? "")
      ? "free"
      : u.plan;
    return { ...u, plan: effectivePlan, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;
const canonicalUserRow = `    const effectivePlan = u.planSelected ? u.plan : "free";
    return { ...u, plan: effectivePlan, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;

if (source.includes(previousEffectiveRow)) {
  source = source.replace(previousEffectiveRow, canonicalUserRow);
} else if (source.includes(originalUserRow)) {
  source = source.replace(originalUserRow, canonicalUserRow);
}

const moduleQueryOld = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)`;
const moduleQueryFiltered = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)`;

if (source.includes(moduleQueryOld)) {
  source = source.replace(moduleQueryOld, moduleQueryFiltered);
}

const featureUsageOld = `  const featureUsage = moduleRows.map((r) => ({
    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),
    count: r.count,
    percentage: Math.round((r.count / totalModuleCount) * 100),
  }));`;
const featureUsageFiltered = `  const canonicalModuleRows = moduleRows.filter((r) => r.module !== "prompt");
  const canonicalModuleTotal = canonicalModuleRows.reduce((sum, row) => sum + row.count, 0) || 1;
  const featureUsage = canonicalModuleRows.map((r) => ({
    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),
    count: r.count,
    percentage: Math.round((r.count / canonicalModuleTotal) * 100),
  }));`;

if (source.includes(featureUsageOld)) {
  source = source.replace(featureUsageOld, featureUsageFiltered);
}

for (const marker of [
  'const effectivePlan = u.planSelected ? u.plan : "free"',
  'const canonicalModuleRows = moduleRows.filter((r) => r.module !== "prompt")',
  'const canonicalModuleTotal = canonicalModuleRows.reduce',
]) {
  if (!source.includes(marker)) throw new Error(`Admin canonical plan/prompt marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin users now honor planSelected and legacy prompt metrics are removed from the canonical response.");
