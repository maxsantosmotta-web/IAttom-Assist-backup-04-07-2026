import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);

function patchPage(path, pageName, donutName) {
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(
    /const PLAN_COLORS: Record<string, string> = \{[\s\S]*?\n\};/,
    `const PLAN_COLORS: Record<string, string> = {
  ADM: ROSE,
  "Sem plano": ORANGE,
  Free: BLUE,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: GOLD,
};`,
  );

  source = source.replace(
    /interface RegisteredPlanStats \{[\s\S]*?\n\}/,
    `interface RegisteredPlanStats {
  totalUsers: number;
  planBreakdown: {
    admin: number;
    unselected: number;
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}`,
  );

  source = source.replace(
    /  const planDefinitions = \[[\s\S]*?\n  \];/,
    `  const planDefinitions = [
    { label: "ADM", color: PLAN_COLORS.ADM },
    { label: "Sem plano", color: PLAN_COLORS["Sem plano"] },
    { label: "Free", color: PLAN_COLORS.Free },
    { label: "Start", color: PLAN_COLORS.Start },
    { label: "Premium", color: PLAN_COLORS.Premium },
    { label: "Pro", color: PLAN_COLORS.Pro },
  ];`,
  );

  const donutRegex = new RegExp(`  const ${donutName} = planDefinitions\\.map\\(\\(plan\\) => \\{[\\s\\S]*?\\n  \\}\\);`);
  const donutReplacement = `  const ${donutName} = planDefinitions.map((plan) => {
    const key = plan.label.toUpperCase();
    let value = 0;
    if (key === "ADM") value = registeredPlans?.planBreakdown.admin ?? 0;
    if (key === "SEM PLANO") value = registeredPlans?.planBreakdown.unselected ?? 0;
    if (key === "FREE") value = registeredPlans?.planBreakdown.free ?? 0;
    if (key === "START") value = registeredPlans?.planBreakdown.pro ?? 0;
    if (key === "PREMIUM") value = registeredPlans?.planBreakdown.business ?? 0;
    if (key === "PRO") value = registeredPlans?.planBreakdown.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });`;

  if (!donutRegex.test(source)) throw new Error(`${pageName} registration donut anchor not found`);
  source = source.replace(donutRegex, donutReplacement);

  for (const marker of [
    "ADM: ROSE",
    '"Sem plano": ORANGE',
    "admin: number;",
    "unselected: number;",
    '{ label: "ADM", color: PLAN_COLORS.ADM }',
    'if (key === "ADM")',
    'if (key === "SEM PLANO")',
  ]) {
    if (!source.includes(marker)) throw new Error(`${pageName} marker missing: ${marker}`);
  }

  fs.writeFileSync(path, source);
}

patchPage(overviewPath, "Admin overview", "planDonut");
patchPage(analyticsPath, "Admin analytics", "planDistributionDonut");

console.log("Admin Overview and Analytics classify each active registration once as ADM, Sem plano, FREE, START, PREMIUM or PRO.");
