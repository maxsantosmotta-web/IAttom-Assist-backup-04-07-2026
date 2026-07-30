import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");

function addColors(source, pageName) {
  if (source.includes('"ADM": ROSE') && source.includes('"Sem plano": ORANGE')) return source;
  const withUnselected = `const PLAN_COLORS: Record<string, string> = {
  "Sem plano": ORANGE,
  Free: BLUE,`;
  const base = `const PLAN_COLORS: Record<string, string> = {
  Free: BLUE,`;
  if (source.includes(withUnselected)) return source.replace(withUnselected, `const PLAN_COLORS: Record<string, string> = {
  "ADM": ROSE,
  "Sem plano": ORANGE,
  Free: BLUE,`);
  if (source.includes(base)) return source.replace(base, `const PLAN_COLORS: Record<string, string> = {
  "ADM": ROSE,
  "Sem plano": ORANGE,
  Free: BLUE,`);
  throw new Error(`${pageName} plan color anchor not found`);
}

function addDefinitions(source, pageName) {
  if (source.includes('{ label: "ADM", color: PLAN_COLORS["ADM"] }')) return source;
  const withUnselected = `  const planDefinitions = [
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },`;
  const base = `  const planDefinitions = [
    { label: "Free", color: PLAN_COLORS.Free },`;
  if (source.includes(withUnselected)) return source.replace(withUnselected, `  const planDefinitions = [
    { label: "ADM", color: PLAN_COLORS["ADM"] },
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },`);
  if (source.includes(base)) return source.replace(base, `  const planDefinitions = [
    { label: "ADM", color: PLAN_COLORS["ADM"] },
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },
    { label: "Free", color: PLAN_COLORS.Free },`);
  throw new Error(`${pageName} plan definitions anchor not found`);
}

overview = addColors(overview, "Admin overview");
overview = addDefinitions(overview, "Admin overview");

if (!overview.includes("admin: number;")) {
  const withUnselected = `planBreakdown: {
    unselected: number;`;
  const base = `planBreakdown: {
    free: number;`;
  if (overview.includes(withUnselected)) overview = overview.replace(withUnselected, `planBreakdown: {
    admin: number;
    unselected: number;`);
  else if (overview.includes(base)) overview = overview.replace(base, `planBreakdown: {
    admin: number;
    unselected: number;
    free: number;`);
  else throw new Error("Admin overview breakdown interface anchor not found");
}

if (!overview.includes('if (key === "ADM")')) {
  const withUnselected = `    let value = 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;`;
  const base = `    let value = 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`;
  if (overview.includes(withUnselected)) overview = overview.replace(withUnselected, `    let value = 0;
    if (key === "ADM") value = registeredPlans?.planBreakdown.admin ?? 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;`);
  else if (overview.includes(base)) overview = overview.replace(base, `    let value = 0;
    if (key === "ADM") value = registeredPlans?.planBreakdown.admin ?? 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;`);
  else throw new Error("Admin overview classification mapping anchor not found");
}

analytics = addColors(analytics, "Admin analytics");
analytics = addDefinitions(analytics, "Admin analytics");

if (!analytics.includes("registrationBreakdown:")) {
  const interfaceAnchor = `  planBreakdown: {
    free: number;`;
  const interfaceReplacement = `  registrationBreakdown: {
    admin: number;
    unselected: number;
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  totalRegistrations: number;
  planBreakdown: {
    free: number;`;
  if (!analytics.includes(interfaceAnchor)) throw new Error("Admin analytics growth interface anchor not found");
  analytics = analytics.replace(interfaceAnchor, interfaceReplacement);
}

if (!analytics.includes('growthStats?.registrationBreakdown.admin')) {
  const donutAnchor = `  const planDistributionDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (growthStats && hasPaidSubscribers) {
      if (plan.label === "Free") value = 0;
      if (plan.label === "Start") value = growthStats.planBreakdown.start ?? growthStats.planBreakdown.pro ?? 0;
      if (plan.label === "Premium") value = growthStats.planBreakdown.premium ?? growthStats.planBreakdown.business ?? 0;
      if (plan.label === "Pro") value = growthStats.planBreakdown.agency ?? 0;
    }
    return { label: plan.label, value, color: plan.color };
  });`;
  const donutReplacement = `  const planDistributionDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (plan.label === "ADM") value = growthStats?.registrationBreakdown.admin ?? 0;
    if (plan.label === "Sem plano") value = growthStats?.registrationBreakdown.unselected ?? 0;
    if (plan.label === "Free") value = growthStats?.registrationBreakdown.free ?? 0;
    if (plan.label === "Start") value = growthStats?.registrationBreakdown.pro ?? 0;
    if (plan.label === "Premium") value = growthStats?.registrationBreakdown.business ?? 0;
    if (plan.label === "Pro") value = growthStats?.registrationBreakdown.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });`;
  if (!analytics.includes(donutAnchor)) throw new Error("Admin analytics distribution donut anchor not found");
  analytics = analytics.replace(donutAnchor, donutReplacement);
}

if (analytics.includes('sub={`de ${growthStats?.totalUsers ?? 0} usuários no total`}')) {
  analytics = analytics.replace('sub={`de ${growthStats?.totalUsers ?? 0} usuários no total`}', 'sub={`de ${growthStats?.totalRegistrations ?? 0} cadastros ativos`}');
}

for (const [name, source, markers] of [
  ["overview", overview, ['"ADM": ROSE', '"Sem plano": ORANGE', "admin: number;", 'if (key === "ADM")']],
  ["analytics", analytics, ['"ADM": ROSE', '"Sem plano": ORANGE', "registrationBreakdown:", "totalRegistrations: number;", "growthStats?.registrationBreakdown.admin"]],
]) {
  for (const marker of markers) if (!source.includes(marker)) throw new Error(`${name} classification marker missing: ${marker}`);
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
console.log("Admin Overview and Analytics now use their correct registration sources without changing financial charts.");