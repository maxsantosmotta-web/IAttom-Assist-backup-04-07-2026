import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");

function patchUserClassification(source, pageName) {
  if (!source.includes('"ADM": ROSE')) {
    if (source.includes('"Sem plano": ORANGE,')) {
      source = source.replace('"Sem plano": ORANGE,', '"ADM": ROSE,\n  "Sem plano": ORANGE,');
    } else {
      const colorAnchor = `const PLAN_COLORS: Record<string, string> = {
  Free: BLUE,`;
      const colorReplacement = `const PLAN_COLORS: Record<string, string> = {
  "ADM": ROSE,
  "Sem plano": ORANGE,
  Free: BLUE,`;
      if (!source.includes(colorAnchor)) throw new Error(`${pageName} plan color anchor not found`);
      source = source.replace(colorAnchor, colorReplacement);
    }
  }

  if (!source.includes("admin: number;")) {
    const breakdownAnchor = `planBreakdown: {
    unselected: number;`;
    const fallbackBreakdownAnchor = `planBreakdown: {
    free: number;`;
    if (source.includes(breakdownAnchor)) {
      source = source.replace(breakdownAnchor, `planBreakdown: {
    admin: number;
    unselected: number;`);
    } else if (source.includes(fallbackBreakdownAnchor)) {
      source = source.replace(fallbackBreakdownAnchor, `planBreakdown: {
    admin: number;
    unselected: number;
    free: number;`);
    } else {
      throw new Error(`${pageName} registered plan breakdown anchor not found`);
    }
  }

  if (!source.includes('{ label: "ADM", color: PLAN_COLORS["ADM"] }')) {
    const definitionsWithUnselected = `  const planDefinitions = [
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },`;
    const definitionsWithoutUnselected = `  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },`;
    if (source.includes(definitionsWithUnselected)) {
      source = source.replace(definitionsWithUnselected, `  const planDefinitions = [
    { label: "ADM", color: PLAN_COLORS["ADM"] },
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },`);
    } else if (source.includes(definitionsWithoutUnselected)) {
      source = source.replace(definitionsWithoutUnselected, `  const planDefinitions = [
    { label: "ADM", color: PLAN_COLORS["ADM"] },
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },
    { label: "Free", color: PLAN_COLORS.Free },`);
    } else {
      throw new Error(`${pageName} plan definitions anchor not found`);
    }
  }

  if (!source.includes('if (key === "ADM")')) {
    const mappingWithUnselected = `    let value = 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;`;
    const mappingWithoutUnselected = `    let value = 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`;
    if (source.includes(mappingWithUnselected)) {
      source = source.replace(mappingWithUnselected, `    let value = 0;
    if (key === "ADM") value = registeredPlans?.planBreakdown.admin ?? 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;`);
    } else if (source.includes(mappingWithoutUnselected)) {
      source = source.replace(mappingWithoutUnselected, `    let value = 0;
    if (key === "ADM") value = registeredPlans?.planBreakdown.admin ?? 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`);
    } else {
      throw new Error(`${pageName} plan classification mapping anchor not found`);
    }
  }

  return source;
}

overview = patchUserClassification(overview, "Admin overview");
analytics = patchUserClassification(analytics, "Admin analytics");

for (const [name, source] of [["overview", overview], ["analytics", analytics]]) {
  for (const marker of [
    '"ADM": ROSE',
    "admin: number;",
    '{ label: "ADM", color: PLAN_COLORS["ADM"] }',
    'if (key === "ADM")',
    'if (key === "SEM PLANO")',
  ]) {
    if (!source.includes(marker)) throw new Error(`${name} classification marker missing: ${marker}`);
  }
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
console.log("Admin Overview and Analytics now show each active registration exactly once as ADM, Sem plano, FREE, START, PREMIUM or PRO.");
