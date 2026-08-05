import { readFileSync, writeFileSync } from "node:fs";

const creditsUrl = new URL("../src/lib/credits.ts", import.meta.url);
const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");

const officialVisualPrices = {
  pro: {
    monthlyDisplay: "R$69/mês",
    yearlyDisplay: "R$697/ano",
    yearlyMonthlyDisplay: "R$58,08/mês",
  },
  business: {
    monthlyDisplay: "R$159/mês",
    yearlyDisplay: "R$1.565/ano",
    yearlyMonthlyDisplay: "R$130,42/mês",
  },
  agency: {
    monthlyDisplay: "R$299/mês",
    yearlyDisplay: "R$2.870/ano",
    yearlyMonthlyDisplay: "R$239,20/mês",
  },
};

for (const [planKey, prices] of Object.entries(officialVisualPrices)) {
  const blockPattern = new RegExp(`  ${planKey}: \\{[\\s\\S]*?\\n  \\},`);
  const match = source.match(blockPattern);
  if (!match) throw new Error(`PLAN_PRICES visual block not found for ${planKey}`);

  let block = match[0];
  block = block
    .replace(/monthlyDisplay: "[^"]*"/, `monthlyDisplay: "${prices.monthlyDisplay}"`)
    .replace(/yearlyDisplay: "[^"]*"/, `yearlyDisplay: "${prices.yearlyDisplay}"`)
    .replace(/yearlyMonthlyDisplay: "[^"]*"/, `yearlyMonthlyDisplay: "${prices.yearlyMonthlyDisplay}"`);

  source = source.replace(match[0], block);
}

const creditPackages = [
  { id: "credits_300", credits: 100, label: "100", price: "R$ 19,90" },
  { id: "credits_700", credits: 200, label: "200", price: "R$ 39,90" },
  { id: "credits_1500", credits: 500, label: "500", price: "R$ 69,90" },
];

for (const pkg of creditPackages) {
  const pattern = new RegExp(`\\{ id: "${pkg.id}",\\s*credits: \\d+,\\s*label: "[^"]+",\\s*price: "[^"]+"`);
  const match = billing.match(pattern);
  if (!match) throw new Error(`Credit package visual block not found for ${pkg.id}`);
  billing = billing.replace(
    match[0],
    `{ id: "${pkg.id}", credits: ${pkg.credits}, label: "${pkg.label}", price: "${pkg.price}"`,
  );
}

const imagePrices = {
  creative_20: "R$ 39,90",
  creative_35: "R$ 69,90",
  creative_50: "R$ 99,90",
};

for (const [id, price] of Object.entries(imagePrices)) {
  const pattern = new RegExp(`(id: "${id}"[^\\n]*price: ")[^"]+("[^\\n]*)`);
  if (!pattern.test(billing)) throw new Error(`Image package visual price not found for ${id}`);
  billing = billing.replace(pattern, `$1${price}$2`);
}

const videoPrices = {
  video_10: "R$ 59,90",
  video_20: "R$ 89,90",
  video_30: "R$ 119,90",
};

for (const [id, price] of Object.entries(videoPrices)) {
  const pattern = new RegExp(`(id: "${id}"[^\\n]*price: ")[^"]+("[^\\n]*)`);
  if (!pattern.test(billing)) throw new Error(`Video package visual price not found for ${id}`);
  billing = billing.replace(pattern, `$1${price}$2`);
}

for (const marker of [
  'monthlyDisplay: "R$69/mês"',
  'yearlyDisplay: "R$697/ano"',
  'monthlyDisplay: "R$159/mês"',
  'yearlyDisplay: "R$1.565/ano"',
  'monthlyDisplay: "R$299/mês"',
  'yearlyDisplay: "R$2.870/ano"',
  'credits: 100, label: "100", price: "R$ 19,90"',
  'credits: 200, label: "200", price: "R$ 39,90"',
  'credits: 500, label: "500", price: "R$ 69,90"',
  'id: "creative_20", tag: "10 IMAGENS", images: 10, price: "R$ 39,90"',
  'id: "creative_35", tag: "20 IMAGENS", images: 20, price: "R$ 69,90"',
  'id: "creative_50", tag: "30 IMAGENS", images: 30, price: "R$ 99,90"',
  'id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 59,90"',
  'id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 89,90"',
  'id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 119,90"',
]) {
  const target = marker.includes("monthlyDisplay") || marker.includes("yearlyDisplay") ? source : billing;
  if (!target.includes(marker)) throw new Error(`Official visual marker missing: ${marker}`);
}

writeFileSync(creditsUrl, source, "utf8");
writeFileSync(billingUrl, billing, "utf8");
console.log("Official plan and package visuals applied without changing checkout identifiers or backend delivery.");

await import("./patch-official-plan-checkout-ids-final.mjs");
