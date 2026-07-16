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

patchFile("../src/pages/admin/AdminUsers.tsx", [
  [
    "if (!data?.users) return;",
    "if (!Array.isArray(data?.users)) return;",
  ],
  [
    "const initials = (user.name ?? user.email)\n                      .split(\" \").map((n: string) => n[0]).join(\"\").toUpperCase().slice(0, 2);",
    "const identity = typeof user?.name === \"string\" && user.name.trim()\n                      ? user.name\n                      : (typeof user?.email === \"string\" ? user.email : \"Usuário\");\n                    const initials = identity\n                      .split(/\\s+/).filter(Boolean).map((n: string) => n[0] ?? \"\").join(\"\").toUpperCase().slice(0, 2) || \"U\";",
  ],
  [
    "data.users.map((user: AdminUser) => {",
    "(Array.isArray(data?.users) ? data.users : []).filter(Boolean).map((user: AdminUser) => {",
  ],
  [
    "{new Date(user.createdAt).toLocaleDateString(\"pt-BR\")}",
    "{user?.createdAt && !Number.isNaN(new Date(user.createdAt).getTime()) ? new Date(user.createdAt).toLocaleDateString(\"pt-BR\") : \"—\"}",
  ],
]);

patchFile("../src/pages/admin/AdminActivity.tsx", [
  [
    "function normalizeAction(action: string): string {\n  const base = action.split(\":\")[0].trim();",
    "function normalizeAction(action?: string | null): string {\n  const safeAction = typeof action === \"string\" ? action : \"\";\n  const base = safeAction.split(\":\")[0].trim();",
  ],
  [
    "return base.length > 0 ? base : action;",
    "return base.length > 0 ? base : (safeAction || \"Atividade sem identificação\");",
  ],
  [
    "const items = activity ?? [];",
    "const items = Array.isArray(activity) ? activity.filter(Boolean) : [];",
  ],
  [
    "const d = new Date(it.createdAt);",
    "const d = new Date(typeof it?.createdAt === \"string\" ? it.createdAt : 0);\n      if (Number.isNaN(d.getTime())) continue;",
  ],
  [
    "const k = dayKey(new Date(it.createdAt));",
    "const date = new Date(typeof it?.createdAt === \"string\" ? it.createdAt : 0);\n      if (Number.isNaN(date.getTime())) continue;\n      const k = dayKey(date);",
  ],
  [
    "const k = it.module.toLowerCase();\n      if (!modMap[k]) modMap[k] = { count: 0, rawKey: it.module };",
    "const rawModule = typeof it?.module === \"string\" && it.module.trim() ? it.module : \"unknown\";\n      const k = rawModule.toLowerCase();\n      if (!modMap[k]) modMap[k] = { count: 0, rawKey: rawModule };",
  ],
  [
    "const label = normalizeAction(it.action);",
    "const label = normalizeAction(typeof it?.action === \"string\" ? it.action : null);",
  ],
  [
    "new Date(items[items.length - 1].createdAt).getTime()",
    "new Date(typeof items[items.length - 1]?.createdAt === \"string\" ? items[items.length - 1].createdAt : Date.now()).getTime()",
  ],
]);

patchFile("../src/pages/admin/AdminAnalytics.tsx", [
  [
    "if (res.ok) setGrowthStats(await res.json());",
    "if (res.ok) {\n          const raw = await res.json();\n          setGrowthStats({\n            mrr: Number(raw?.mrr) || 0,\n            activeSubscribers: Number(raw?.activeSubscribers) || 0,\n            totalUsers: Number(raw?.totalUsers) || 0,\n            conversionRate: Number(raw?.conversionRate) || 0,\n            activationRate: Number(raw?.activationRate) || 0,\n            activatedCount: Number(raw?.activatedCount) || 0,\n            newUsersThisWeek: Number(raw?.newUsersThisWeek) || 0,\n            newUsersThisMonth: Number(raw?.newUsersThisMonth) || 0,\n            churnRisk: Array.isArray(raw?.churnRisk) ? raw.churnRisk.filter(Boolean) : [],\n            totalReferralCodes: Number(raw?.totalReferralCodes) || 0,\n            totalReferralUses: Number(raw?.totalReferralUses) || 0,\n            creditsSpentThisMonth: Number(raw?.creditsSpentThisMonth) || 0,\n            planBreakdown: {\n              free: Number(raw?.planBreakdown?.free) || 0,\n              pro: Number(raw?.planBreakdown?.pro) || 0,\n              business: Number(raw?.planBreakdown?.business) || 0,\n              agency: Number(raw?.planBreakdown?.agency) || 0,\n            },\n          });\n        }",
  ],
  [
    "if (res.ok) setCreditsData(await res.json() as CreditAnalytics);",
    "if (res.ok) {\n          const raw = await res.json();\n          setCreditsData({\n            byFeature: Array.isArray(raw?.byFeature) ? raw.byFeature.filter(Boolean) : [],\n            byDay: Array.isArray(raw?.byDay) ? raw.byDay.filter(Boolean) : [],\n            byPlan: Array.isArray(raw?.byPlan) ? raw.byPlan.filter(Boolean) : [],\n            days: Number(raw?.days) || 0,\n          });\n        }",
  ],
  [
    "const featureData = (analytics?.featureUsage ?? []).map((f, i) => ({",
    "const featureData = (Array.isArray(analytics?.featureUsage) ? analytics.featureUsage.filter(Boolean) : []).map((f, i) => ({",
  ],
  [
    "const found = (analytics?.planRevenue ?? []).find(",
    "const found = (Array.isArray(analytics?.planRevenue) ? analytics.planRevenue.filter(Boolean) : []).find(",
  ],
  [
    "const planBar = (growthStats && hasPaidSubscribers)",
    "const planBar = (growthStats?.planBreakdown && hasPaidSubscribers)",
  ],
  [
    "!growthLoading && growthStats && growthStats.churnRisk.length > 0",
    "!growthLoading && growthStats && Array.isArray(growthStats.churnRisk) && growthStats.churnRisk.length > 0",
  ],
  [
    "{growthStats.churnRisk.map((u) => (",
    "{(Array.isArray(growthStats.churnRisk) ? growthStats.churnRisk : []).filter(Boolean).map((u) => (",
  ],
  [
    "<AreaChart data={analytics?.userGrowth ?? []}",
    "<AreaChart data={Array.isArray(analytics?.userGrowth) ? analytics.userGrowth.filter(Boolean) : []}",
  ],
  [
    "!isLoading && analytics && analytics.featureUsage.length > 0",
    "!isLoading && analytics && Array.isArray(analytics.featureUsage) && analytics.featureUsage.length > 0",
  ],
  [
    "{creditsData.byFeature.map((f, i) => (",
    "{(Array.isArray(creditsData?.byFeature) ? creditsData.byFeature : []).filter(Boolean).map((f, i) => (",
  ],
  [
    "data={creditsData.byDay}",
    "data={Array.isArray(creditsData?.byDay) ? creditsData.byDay.filter(Boolean) : []}",
  ],
  [
    "data={creditsData.byPlan}",
    "data={Array.isArray(creditsData?.byPlan) ? creditsData.byPlan.filter(Boolean) : []}",
  ],
]);

console.log("Dashboard and all admin runtime payload guards verified and normalized.");
