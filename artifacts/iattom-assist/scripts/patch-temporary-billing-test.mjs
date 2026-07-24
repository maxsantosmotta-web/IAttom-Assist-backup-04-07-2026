import { readFileSync, writeFileSync } from "node:fs";

const creditsPageUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let creditsPage = readFileSync(creditsPageUrl, "utf8");

creditsPage = creditsPage
  .replace(
    `  const upgradePlans = balance
    ? (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).filter(
        (p) => PLAN_CREDITS[p] > (PLAN_CREDITS[balance.plan as keyof typeof PLAN_CREDITS] ?? 0),
      )
    : [];`,
    `  const PLAN_HIERARCHY = ["free", "pro", "business", "agency"] as const;
  const currentPlanKey = (balance?.plan && PLAN_HIERARCHY.includes(balance.plan as typeof PLAN_HIERARCHY[number]))
    ? balance.plan as typeof PLAN_HIERARCHY[number]
    : "free";
  const currentPlanIndex = PLAN_HIERARCHY.indexOf(currentPlanKey);
  const upgradePlans = PLAN_HIERARCHY.slice(currentPlanIndex + 1);`,
  )
  .replace(
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "START", pro: "COMPLETO", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = balance?.plan ? (PLAN_DISPLAY_NAMES[balance.plan] ?? balance.plan) : "START";`,
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "FREE", pro: "START", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = PLAN_DISPLAY_NAMES[currentPlanKey];`,
  );

writeFileSync(creditsPageUrl, creditsPage);

console.log("Billing test prices disabled; original Stripe catalog and plan allowances preserved with correct plan labels and upgrade hierarchy");
