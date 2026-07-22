import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

source = source.replace(
  /const PLAN_COLORS: Record<string, string> = \{[\s\S]*?\n\};/,
  `const PLAN_COLORS: Record<string, string> = {
  Free: GOLD,
  Start: EMERALD,
  Premium: PURPLE,
  Pro: ROSE,
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

const growthInterfaceBefore = `  planBreakdown: {
    free: number;
    start?: number;
    premium?: number;
    pro: number;
    business: number;
    agency: number;
  };
}`;
const growthInterfaceAfter = `  planBreakdown: {
    free: number;
    start?: number;
    premium?: number;
    pro: number;
    business: number;
    agency: number;
  };
  mrrByPlan: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
}`;
if (source.includes(growthInterfaceBefore)) {
  source = source.replace(growthInterfaceBefore, growthInterfaceAfter);
}

source = source.replace(
  /  const hasPaidSubscribers = \(growthStats\?\.activeSubscribers \?\? 0\) > 0;\n/,
  "",
);

source = source.replace(
  /  const revenueByLabel = new Map<string, number>\(\);[\s\S]*?\n  }\n\n  const planDistributionDonut/,
  `  const revenueByLabel = new Map<string, number>([
    ["Free", growthStats?.mrrByPlan?.free ?? 0],
    ["Start", growthStats?.mrrByPlan?.pro ?? 0],
    ["Premium", growthStats?.mrrByPlan?.business ?? 0],
    ["Pro", growthStats?.mrrByPlan?.agency ?? 0],
  ]);

  const planDistributionDonut`,
);

source = source.replace(
  /  const planDistributionDonut = planDefinitions\.map\(\(plan\) => \{[\s\S]*?\n  \}\);/,
  `  const planDistributionDonut = planDefinitions.map((plan) => {
    let value = 0;
    if (plan.label === "Free") value = growthStats?.planBreakdown.free ?? 0;
    if (plan.label === "Start") value = growthStats?.planBreakdown.pro ?? 0;
    if (plan.label === "Premium") value = growthStats?.planBreakdown.business ?? 0;
    if (plan.label === "Pro") value = growthStats?.planBreakdown.agency ?? 0;
    return { label: plan.label, value, color: plan.color };
  });`,
);

source = source.replace(
  '`$${p.value.toLocaleString()}`',
  'p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })',
);

writeFileSync(fileUrl, source);
console.log("Admin analytics now uses the unified financial source with fixed plan colors.");
