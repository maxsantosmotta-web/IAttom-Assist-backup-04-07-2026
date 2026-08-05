import fs from "node:fs";

const servicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
const routePath = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(servicePath, "utf8");
let routes = fs.readFileSync(routePath, "utf8");

const constantsMarker = 'const BASE_PATH = (process.env.BASE_PATH ?? "/").replace(/\\\/$/, "");';
const packageConstants = `

const CREDIT_PACKAGE_PRICE_IDS: Record<string, string> = {
  credits_300: "price_1U0DyxAYtu5nLhAZAC4mb6al",
  credits_700: "price_1U0E1PAYtu5nLhAZfVQHJe0W",
  credits_1500: "price_1U0E2qAYtu5nLhAZ5jnO2ZsA",
};

const CREATIVE_PACKAGE_PRICE_IDS: Record<string, string> = {
  creative_20: "price_1U0ENdAYtu5nLhAZh1owGZc2",
  creative_35: "price_1U0EPSAYtu5nLhAZNbcb4TCJ",
  creative_50: "price_1U0ERSAYtu5nLhAZKvYw4HjL",
};

const OFFICIAL_VIDEO_PACKAGE_PRICE_IDS: Record<string, string> = {
  video_10: "price_1U0EDAAYtu5nLhAZpWhOVTvB",
  video_20: "price_1U0EEMAYtu5nLhAZj1VLUXRM",
  video_30: "price_1U0EFGAYtu5nLhAZgTswLJlM",
};

const TEST_VIDEO_PACKAGE_PRICE_IDS: Record<string, string> = {
  video_10: "price_1TyO8kAYtu5nLhAZFL8AJ8F9",
  video_20: "price_1TyOBZAYtu5nLhAZ2JqbZb09",
  video_30: "price_1TyOCZAYtu5nLhAZkTdXPnee",
};

const VIDEO_PACKAGE_CATALOG_MODE: "official" | "test" = "official";
const VIDEO_PACKAGE_PRICE_IDS = VIDEO_PACKAGE_CATALOG_MODE === "test"
  ? TEST_VIDEO_PACKAGE_PRICE_IDS
  : OFFICIAL_VIDEO_PACKAGE_PRICE_IDS;`;

const existingConstants = /\nconst CREDIT_PACKAGE_PRICE_IDS:[\s\S]*?const VIDEO_PACKAGE_PRICE_IDS[^;]*;\n?/;
if (existingConstants.test(source)) {
  source = source.replace(existingConstants, packageConstants + "\n");
} else if (!source.includes("OFFICIAL_VIDEO_PACKAGE_PRICE_IDS")) {
  if (!source.includes(constantsMarker)) throw new Error("stripeService constants marker not found");
  source = source.replace(constantsMarker, constantsMarker + packageConstants);
}

function replaceLineItems(functionName, idExpression, priceMapName) {
  const functionStart = source.indexOf(`export async function ${functionName}`);
  if (functionStart === -1) throw new Error(`${functionName} not found`);
  const nextFunction = source.indexOf("export async function ", functionStart + 1);
  const functionEnd = nextFunction === -1 ? source.length : nextFunction;
  let block = source.slice(functionStart, functionEnd);

  const priceGuard = `  const catalogPriceId = ${priceMapName}[${idExpression}];\n  if (!catalogPriceId) throw new Error("Invalid Stripe catalog package");\n`;
  if (!block.includes("const catalogPriceId =")) {
    const stripeLine = "  const stripe = await getUncachableStripeClient();\n";
    if (!block.includes(stripeLine)) throw new Error(`${functionName} Stripe marker not found`);
    block = block.replace(stripeLine, stripeLine + priceGuard);
  }

  const lineItemsStart = block.indexOf("    line_items: [");
  const modeMarker = block.indexOf('    mode: "payment",', lineItemsStart);
  if (lineItemsStart === -1 || modeMarker === -1) throw new Error(`${functionName} line_items markers not found`);
  block = block.slice(0, lineItemsStart) + "    line_items: [{ price: catalogPriceId, quantity: 1 }],\n" + block.slice(modeMarker);
  source = source.slice(0, functionStart) + block + source.slice(functionEnd);
}

replaceLineItems("createCreditPurchaseCheckoutSession", "packageId", "CREDIT_PACKAGE_PRICE_IDS");
replaceLineItems("createCreativePurchaseCheckoutSession", "packageId", "CREATIVE_PACKAGE_PRICE_IDS");
replaceLineItems("createVideoPackCheckoutSession", "packId", "VIDEO_PACKAGE_PRICE_IDS");

routes = routes
  .replace(
    /const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREDIT_PACKAGES = [
  { id: "credits_300", credits: 100, unitAmountBrl: 1990, name: "Pacote 100 Créditos", displayPrice: "R$ 19,90" },
  { id: "credits_700", credits: 200, unitAmountBrl: 3990, name: "Pacote 200 Créditos", displayPrice: "R$ 39,90" },
  { id: "credits_1500", credits: 500, unitAmountBrl: 6990, name: "Pacote 500 Créditos", displayPrice: "R$ 69,90" },
] as const;`,
  )
  .replace(
    /const CREATIVE_PACKAGES = \[[\s\S]*?\] as const;/,
    `const CREATIVE_PACKAGES = [
  { id: "creative_20", creativeCredits: 100, unitAmountBrl: 3990, name: "Pacote 10 Imagens Premium", displayPrice: "R$ 39,90" },
  { id: "creative_35", creativeCredits: 200, unitAmountBrl: 6990, name: "Pacote 20 Imagens Premium", displayPrice: "R$ 69,90" },
  { id: "creative_50", creativeCredits: 300, unitAmountBrl: 9990, name: "Pacote 30 Imagens Premium", displayPrice: "R$ 99,90" },
] as const;`,
  )
  .replace(
    /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/,
    `const VIDEO_PACKAGES = [
  { id: "video_10", videos: 10, unitAmountBrl: 5990, name: "Pacote 10 Vídeos com Efeito" },
  { id: "video_20", videos: 20, unitAmountBrl: 8990, name: "Pacote 20 Vídeos com Efeito" },
  { id: "video_30", videos: 30, unitAmountBrl: 11990, name: "Pacote 30 Vídeos com Efeito" },
] as const;`,
  );

for (const marker of [
  'credits_300: "price_1U0DyxAYtu5nLhAZAC4mb6al"',
  'credits_700: "price_1U0E1PAYtu5nLhAZfVQHJe0W"',
  'credits_1500: "price_1U0E2qAYtu5nLhAZ5jnO2ZsA"',
  'creative_20: "price_1U0ENdAYtu5nLhAZh1owGZc2"',
  'creative_35: "price_1U0EPSAYtu5nLhAZNbcb4TCJ"',
  'creative_50: "price_1U0ERSAYtu5nLhAZKvYw4HjL"',
  'video_10: "price_1U0EDAAYtu5nLhAZpWhOVTvB"',
  'video_20: "price_1U0EEMAYtu5nLhAZj1VLUXRM"',
  'video_30: "price_1U0EFGAYtu5nLhAZgTswLJlM"',
  'video_10: "price_1TyO8kAYtu5nLhAZFL8AJ8F9"',
  'video_20: "price_1TyOBZAYtu5nLhAZ2JqbZb09"',
  'video_30: "price_1TyOCZAYtu5nLhAZkTdXPnee"',
  'VIDEO_PACKAGE_CATALOG_MODE: "official" | "test" = "official"',
]) {
  if (!source.includes(marker)) throw new Error(`Catalog marker missing: ${marker}`);
}
if (/id: "video_(5|7)"/.test(routes)) throw new Error("Legacy video packages are still active");

fs.writeFileSync(servicePath, source);
fs.writeFileSync(routePath, routes);
console.log("New official package catalog registered; verified test video Price IDs remain separate and untouched.");

await import("./patch-official-plan-price-ids-final.mjs");
