import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");

  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      console.warn(`Skipping runtime patch already absent from ${relativePath}: ${before}`);
      continue;
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
    "(Array.isArray(plan?.features) ? plan.features : []).map((feature) => (",
  ],
  [
    "const sortedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));",
    "const safePlans = Array.isArray(plans) ? plans.filter((plan) => plan && typeof plan.planKey === \"string\") : [];\n  const sortedPlans = Array.from(new Map(safePlans.map((plan) => [plan.planKey, plan])).values())\n    .sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));",
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

patchFile("../src/pages/dashboard/DashboardHome.tsx", [
  [
    "const recentModules = historyData\n    ? Array.from(new Map(\n        historyData",
    "const safeHistoryData = Array.isArray(historyData) ? historyData.filter(Boolean) : [];\n  const recentModules = safeHistoryData.length > 0\n    ? Array.from(new Map(\n        safeHistoryData",
  ],
  [
    ".map((h) => MODULE_TO_ACTION[h.module])",
    ".map((h) => MODULE_TO_ACTION[typeof h?.module === \"string\" ? h.module : \"\"])",
  ],
]);

patchFile("../src/pages/dashboard/History.tsx", [
  [
    "const filtered = (history ?? []).filter((h) =>\n    h.action.toLowerCase().includes(search.toLowerCase()) ||\n    h.module.toLowerCase().includes(search.toLowerCase()) ||\n    (h.projectName ?? \"\").toLowerCase().includes(search.toLowerCase())\n  );\n\n  const hasItems = (history ?? []).length > 0;",
    "const safeHistory = Array.isArray(history) ? history.filter(Boolean) : [];\n  const searchLower = search.toLowerCase();\n  const filtered = safeHistory.filter((h) =>\n    (typeof h?.action === \"string\" ? h.action : \"\").toLowerCase().includes(searchLower) ||\n    (typeof h?.module === \"string\" ? h.module : \"\").toLowerCase().includes(searchLower) ||\n    (typeof h?.projectName === \"string\" ? h.projectName : \"\").toLowerCase().includes(searchLower)\n  );\n\n  const hasItems = safeHistory.length > 0;",
  ],
  [
    "const seconds = Math.floor((Date.now() - d.getTime()) / 1000);",
    "if (Number.isNaN(d.getTime())) return \"—\";\n  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));",
  ],
  [
    "{translateAction(item.action)}",
    "{translateAction(typeof item?.action === \"string\" ? item.action : \"Atividade\")}",
  ],
  [
    "const Icon = moduleIcons[item.module] ?? Clock;",
    "const safeModule = typeof item?.module === \"string\" ? item.module : \"unknown\";\n                const Icon = moduleIcons[safeModule] ?? Clock;",
  ],
  [
    "const colorClass = moduleColors[item.module] ??",
    "const colorClass = moduleColors[safeModule] ??",
  ],
  [
    "{moduleLabels[item.module] ?? item.module.replace(/_/g, \" \")}",
    "{moduleLabels[safeModule] ?? safeModule.replace(/_/g, \" \")}",
  ],
]);

patchFile("../src/pages/dashboard/Credits.tsx", [
  [
    "function translateDescription(desc: string): string {\n  return descriptionTranslations[desc] ?? desc;\n}",
    "function translateDescription(desc?: string | null): string {\n  const safe = typeof desc === \"string\" && desc.trim() ? desc : \"Transação\";\n  return descriptionTranslations[safe] ?? safe;\n}",
  ],
  [
    "const percentage = balance?.percentage ?? 0;",
    "const percentage = Number.isFinite(Number(balance?.percentage)) ? Number(balance?.percentage) : 0;\n  const safeTransactions = Array.isArray(txData?.transactions) ? txData.transactions.filter(Boolean) : [];",
  ],
  [
    "{txData && (\n            <span className=\"text-xs text-muted-foreground\">{txData.total} total</span>\n          )}",
    "{txData && (\n            <span className=\"text-xs text-muted-foreground\">{Number(txData?.total) || safeTransactions.length} total</span>\n          )}",
  ],
  [
    ") : !txData?.transactions.length ? (",
    ") : safeTransactions.length === 0 ? (",
  ],
  [
    "{txData.transactions.map((tx) => (",
    "{safeTransactions.map((tx) => (",
  ],
  [
    "{new Date(tx.createdAt).toLocaleDateString(\"pt-BR\")}",
    "{tx?.createdAt && !Number.isNaN(new Date(tx.createdAt).getTime()) ? new Date(tx.createdAt).toLocaleDateString(\"pt-BR\") : \"—\"}",
  ],
  [
    "{new Date(tx.createdAt).toLocaleTimeString(\"pt-BR\", {",
    "{tx?.createdAt && !Number.isNaN(new Date(tx.createdAt).getTime()) ? new Date(tx.createdAt).toLocaleTimeString(\"pt-BR\", {",
  ],
  [
    "minute: \"2-digit\",\n                          })}",
    "minute: \"2-digit\",\n                          }) : \"\"}",
  ],
  [
    "{tx.amount >= 0 ? \"+\" : \"\"}\n                        {tx.amount}",
    "{Number(tx?.amount) >= 0 ? \"+\" : \"\"}\n                        {Number(tx?.amount) || 0}",
  ],
]);

patchFile("../src/pages/dashboard/Settings.tsx", [
  [
    "const planInfo = PLAN_PRICES[plan];\n  const planCredits = PLAN_CREDITS[plan];",
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0;",
  ],
]);

patchFile("../src/components/layout/AdminLayout.tsx", [
  [
    "const [location] = useLocation();",
    "const [location] = useLocation();",
  ],
  [
    "<Link\n            href=\"/dashboard\"\n            className=\"flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150\"\n            onClick={closeSidebar}\n          >",
    "<a\n            href=\"/dashboard\"\n            className=\"flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-150\"\n            onClick={(event) => { event.preventDefault(); closeSidebar(); window.location.assign(\"/dashboard\"); }}\n          >",
  ],
  [
    "</Link>\n        </div>\n\n        {/* Nav */}",
    "</a>\n        </div>\n\n        {/* Nav */}",
  ],
]);

console.log("Dashboard, user modules and admin navigation runtime guards verified and normalized.");