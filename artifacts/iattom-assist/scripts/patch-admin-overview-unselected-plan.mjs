import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

if (!source.includes('"Sem plano":')) {
  const colorAnchor = `const PLAN_COLORS: Record<string, string> = {
  Free: BLUE,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: GOLD,
};`;
  const colorReplacement = `const PLAN_COLORS: Record<string, string> = {
  "Sem plano": ORANGE,
  Free: BLUE,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: GOLD,
};`;
  if (!source.includes(colorAnchor)) throw new Error("Admin overview plan color anchor not found");
  source = source.replace(colorAnchor, colorReplacement);
}

if (!source.includes("unselected: number;")) {
  const statsAnchor = `interface RegisteredPlanStats {
  totalUsers: number;
  planBreakdown: {
    free: number;`;
  const statsReplacement = `interface RegisteredPlanStats {
  totalUsers: number;
  planBreakdown: {
    unselected: number;
    free: number;`;
  if (!source.includes(statsAnchor)) throw new Error("RegisteredPlanStats anchor not found");
  source = source.replace(statsAnchor, statsReplacement);
}

if (!source.includes('{ label: "Sem plano", color: PLAN_COLORS["Sem plano"] }')) {
  const definitionsAnchor = `  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },`;
  const definitionsReplacement = `  const planDefinitions = [
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },
    { label: "Free", color: PLAN_COLORS.Free },`;
  if (!source.includes(definitionsAnchor)) throw new Error("Admin overview plan definitions anchor not found");
  source = source.replace(definitionsAnchor, definitionsReplacement);
}

if (!source.includes('if (key === "SEM PLANO")')) {
  const donutAnchor = `    let value = 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`;
  const donutReplacement = `    let value = 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`;
  if (!source.includes(donutAnchor)) throw new Error("Admin overview plan donut anchor not found");
  source = source.replace(donutAnchor, donutReplacement);
}

for (const marker of [
  '"Sem plano": ORANGE',
  "unselected: number;",
  '{ label: "Sem plano", color: PLAN_COLORS["Sem plano"] }',
  'if (key === "SEM PLANO")',
]) {
  if (!source.includes(marker)) throw new Error(`Admin overview unselected-plan marker missing: ${marker}`);
}

fs.writeFileSync(pagePath, source);
console.log("Admin overview now displays users without a selected plan as a separate category.");
