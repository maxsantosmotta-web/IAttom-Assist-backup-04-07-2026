import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

const userRowOld = `    return { ...u, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;
const userRowNew = `    const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);
    const effectivePlan = u.plan !== "free" && !activeSubscriptionStatuses.has(u.stripeSubscriptionStatus ?? "")
      ? "free"
      : u.plan;
    return { ...u, plan: effectivePlan, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };`;

if (source.includes(userRowOld)) {
  source = source.replace(userRowOld, userRowNew);
}

const moduleQueryOld = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)`;
const moduleQueryNew = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)`;

if (source.includes(moduleQueryOld)) {
  source = source.replace(moduleQueryOld, moduleQueryNew);
}

for (const marker of [
  'const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"])',
  'plan: effectivePlan',
  '.where(ne(historyTable.module, "prompt"))',
]) {
  if (!source.includes(marker)) throw new Error(`Admin effective-plan/prompt metric marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin users use effective subscription status and legacy prompt metrics are excluded.");
