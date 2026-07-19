import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

source = source.replace(
  /const PLAN_DISPLAY_NAMES: Record<string, string> = \{[\s\S]*?\n\};/,
  `const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};`,
);

source = source.replace(
  /const PLAN_MRR_LABEL: Record<string, string> = \{[\s\S]*?\n\};/,
  `const PLAN_MRR_LABEL: Record<string, string> = {
  free: "MRR FREE",
  pro: "MRR START",
  business: "MRR PREMIUM",
  agency: "MRR PRO",
};`,
);

source = source.replace(
  /const PLAN_PT_SHORT: Record<string, string> = \{[\s\S]*?\n\};/,
  `const PLAN_PT_SHORT: Record<string, string> = {
  free: "FREE",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};`,
);

source = source.replace(
  /  const FIXED_PLAN_ORDER = \[[\s\S]*?  const revenueData = planRevenueDisplay;/,
  `  const PLAN_MONTHLY_PRICES: Record<string, number> = {
    free: 0,
    pro: 69,
    business: 159,
    agency: 299,
  };
  const planRevenueDisplay = [
    { plan: "FREE", key: "free" },
    { plan: "START", key: "pro" },
    { plan: "PREMIUM", key: "business" },
    { plan: "PRO", key: "agency" },
  ].map(({ plan, key }) => {
    const users = growthStats?.planBreakdown?.[key as keyof GrowthStats["planBreakdown"]] ?? 0;
    return { plan, users, mrr: users * (PLAN_MONTHLY_PRICES[key] ?? 0) };
  });
  const revenueData = planRevenueDisplay;`,
);

source = source.replace(
  `        { name: "START",    users: growthStats.planBreakdown.free,     fill: "#60a5fa" },
        { name: "COMPLETO", users: growthStats.planBreakdown.pro,      fill: "#34d399" },
        { name: "PREMIUM",  users: growthStats.planBreakdown.business, fill: "#a78bfa" },
        { name: "PRO",      users: growthStats.planBreakdown.agency,   fill: "#C9A84C" },`,
  `        { name: "FREE",    users: growthStats.planBreakdown.free,     fill: "#60a5fa" },
        { name: "START",   users: growthStats.planBreakdown.pro,      fill: "#34d399" },
        { name: "PREMIUM", users: growthStats.planBreakdown.business, fill: "#a78bfa" },
        { name: "PRO",     users: growthStats.planBreakdown.agency,   fill: "#C9A84C" },`,
);

source = source.replace(
  'value={`$${growthStats?.mrr?.toLocaleString() ?? 0}`}',
  'value={(growthStats?.mrr ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}',
);

source = source.replace(
  '`$${p.value.toLocaleString()}`',
  'p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })',
);

writeFileSync(fileUrl, source);
console.log("Admin commercial analytics guard applied.");
