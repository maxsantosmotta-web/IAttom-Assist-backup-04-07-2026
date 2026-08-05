import { readFileSync, writeFileSync } from "node:fs";

const creditsUrl = new URL("../src/lib/credits.ts", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");

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

for (const marker of [
  'monthlyDisplay: "R$69/mês"',
  'yearlyDisplay: "R$697/ano"',
  'yearlyMonthlyDisplay: "R$58,08/mês"',
  'monthlyDisplay: "R$159/mês"',
  'yearlyDisplay: "R$1.565/ano"',
  'yearlyMonthlyDisplay: "R$130,42/mês"',
  'monthlyDisplay: "R$299/mês"',
  'yearlyDisplay: "R$2.870/ano"',
  'yearlyMonthlyDisplay: "R$239,20/mês"',
]) {
  if (!source.includes(marker)) {
    throw new Error(`Official visual plan price marker missing: ${marker}`);
  }
}

writeFileSync(creditsUrl, source, "utf8");
console.log("Official monthly and annual plan prices restored in visual catalog only.");
