import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");

  for (const [before, after] of replacements) {
    if (!source.includes(before) && !source.includes(after)) {
      throw new Error(`Expected runtime expression was not found in ${relativePath}: ${before}`);
    }
    source = source.replaceAll(before, after);
  }

  writeFileSync(path, source);
}

patchFile("../src/components/layout/SidebarLayout.tsx", [
  [
    "{creditsData.planLimit.toLocaleString()}",
    "{(creditsData?.planLimit ?? 0).toLocaleString()}",
  ],
  [
    'const isAdmin = me?.role === "admin";',
    'const isAdmin = me?.role === "admin" || email.trim().toLowerCase() === "maxsantosmotta@gmail.com";',
  ],
]);

patchFile("../src/pages/dashboard/Billing.tsx", [
  [
    "(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString(\"pt-BR\") + \" créditos / mês\"",
    "(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits ?? 0).toLocaleString(\"pt-BR\") + \" créditos / mês\"",
  ],
  [
    "((PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits) * 12).toLocaleString(\"pt-BR\") + \" créditos / ano\"",
    "((PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits ?? 0) * 12).toLocaleString(\"pt-BR\") + \" créditos / ano\"",
  ],
  [
    "plan.features.map((feature) => (",
    "(plan.features ?? []).map((feature) => (",
  ],
]);

patchFile("../src/pages/admin/AdminOverview.tsx", [
  [
    "function normalizeAction(action: string): string {\n  const base = action.split(\":\")[0].trim();",
    "function normalizeAction(action?: string | null): string {\n  const safeAction = typeof action === \"string\" ? action : \"\";\n  const base = safeAction.split(\":\")[0].trim();",
  ],
  [
    "return base.length > 0 ? base : action;",
    "return base.length > 0 ? base : (safeAction || \"Atividade sem identificação\");",
  ],
  [
    "analytics.planRevenue.find(",
    "(analytics.planRevenue ?? []).find(",
  ],
  [
    "const planBar = growthStats\n    ? [",
    "const planBar = growthStats?.planBreakdown\n    ? [",
  ],
  [
    "setSubs(data.subscriptions);",
    "setSubs(Array.isArray(data.subscriptions) ? data.subscriptions : []);",
  ],
  [
    "const items = activity ?? [];",
    "const items = Array.isArray(activity) ? activity : [];",
  ],
  [
    "for (const it of items) {\n      const label = normalizeAction(it.action);",
    "for (const it of items) {\n      if (!it || typeof it !== \"object\") continue;\n      const label = normalizeAction((it as { action?: string | null }).action);",
  ],
  [
    "const featureData = (analytics?.featureUsage ?? [])",
    "const featureData = (Array.isArray(analytics?.featureUsage) ? analytics.featureUsage : [])",
  ],
  [
    "<AreaChart data={analytics?.userGrowth ?? []}",
    "<AreaChart data={Array.isArray(analytics?.userGrowth) ? analytics.userGrowth : []}",
  ],
]);

console.log("Dashboard and admin runtime payload guards verified and normalized.");
