import { readFileSync, writeFileSync } from "node:fs";

const stripeRouteUrl = new URL("../src/routes/stripe.ts", import.meta.url);
let source = readFileSync(stripeRouteUrl, "utf8");

const officialPlanPriceIds = `const PLAN_PRICE_IDS = {
  pro: {
    monthly: "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
    annual: "price_1TunNxAYtu5nLhAZw0frXi2Z",
  },
  business: {
    monthly: "price_1TunQhAYtu5nLhAZu5QXWW31",
    annual: "price_1TunROAYtu5nLhAZqhKUuslz",
  },
  agency: {
    monthly: "price_1TunTDAYtu5nLhAZDfzTn8Cm",
    annual: "price_1TunTgAYtu5nLhAZ5nRh52J8",
  },
} as const;`;

const planPricePattern = /const PLAN_PRICE_IDS = \{[\s\S]*?\} as const;/;
if (!planPricePattern.test(source)) throw new Error("PLAN_PRICE_IDS block not found in Stripe route");
source = source.replace(planPricePattern, officialPlanPriceIds);
source = source.replace('source: "temporary_test_price_ids"', 'source: "official_plan_price_ids"');

for (const marker of [
  "ALLOWED_PLAN_PRICE_IDS.get(priceId)",
  '[PLAN_PRICE_IDS.pro.monthly, "pro"]',
  '[PLAN_PRICE_IDS.pro.annual, "pro"]',
  '[PLAN_PRICE_IDS.business.monthly, "business"]',
  '[PLAN_PRICE_IDS.business.annual, "business"]',
  '[PLAN_PRICE_IDS.agency.monthly, "agency"]',
  '[PLAN_PRICE_IDS.agency.annual, "agency"]',
  "price_1TunJ2AYtu5nLhAZPd1Ai0hD",
  "price_1TunNxAYtu5nLhAZw0frXi2Z",
  "price_1TunQhAYtu5nLhAZu5QXWW31",
  "price_1TunROAYtu5nLhAZqhKUuslz",
  "price_1TunTDAYtu5nLhAZDfzTn8Cm",
  "price_1TunTgAYtu5nLhAZ5nRh52J8",
]) {
  if (!source.includes(marker)) throw new Error(`Official API plan marker missing: ${marker}`);
}

writeFileSync(stripeRouteUrl, source);
console.log("Official monthly and annual plan Price IDs applied to API validation and reconciliation.");
