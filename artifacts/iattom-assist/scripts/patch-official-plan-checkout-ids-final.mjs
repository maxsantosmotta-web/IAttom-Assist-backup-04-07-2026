import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);

let billing = readFileSync(billingUrl, "utf8");
let modal = readFileSync(modalUrl, "utf8");

const replacements = [
  ["price_1TvgAOAYtu5nLhAZmgqhsTxJ", "price_1TunJ2AYtu5nLhAZPd1Ai0hD"],
  ["price_1TvgDBAYtu5nLhAZsgenq5SJ", "price_1TunNxAYtu5nLhAZw0frXi2Z"],
  ["price_1TvgEwAYtu5nLhAZvWozumfH", "price_1TunQhAYtu5nLhAZu5QXWW31"],
  ["price_1TvgFWAYtu5nLhAZuT001wT5", "price_1TunROAYtu5nLhAZqhKUuslz"],
  ["price_1TvgGHAYtu5nLhAZt4gYmBM5", "price_1TunTDAYtu5nLhAZDfzTn8Cm"],
  ["price_1TvgGgAYtu5nLhAZO8FYa6nK", "price_1TunTgAYtu5nLhAZ5nRh52J8"],
] as const;

for (const [testPriceId, officialPriceId] of replacements) {
  billing = billing.replaceAll(testPriceId, officialPriceId);
  modal = modal.replaceAll(testPriceId, officialPriceId);
}

for (const [, officialPriceId] of replacements) {
  if (!billing.includes(officialPriceId)) {
    throw new Error(`Official Billing Price ID missing: ${officialPriceId}`);
  }
  if (!modal.includes(officialPriceId)) {
    throw new Error(`Official modal Price ID missing: ${officialPriceId}`);
  }
}

for (const [testPriceId] of replacements) {
  if (billing.includes(testPriceId) || modal.includes(testPriceId)) {
    throw new Error(`Test plan Price ID remains active: ${testPriceId}`);
  }
}

writeFileSync(billingUrl, billing, "utf8");
writeFileSync(modalUrl, modal, "utf8");
console.log("Only temporary plan Price IDs were replaced with the six official Stripe Price IDs.");
