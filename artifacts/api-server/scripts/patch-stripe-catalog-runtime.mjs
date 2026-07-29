import fs from "node:fs";

const servicePath = new URL("../src/lib/stripeService.ts", import.meta.url);
const routePath = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(servicePath, "utf8");
let routes = fs.readFileSync(routePath, "utf8");

const constantsMarker = 'const BASE_PATH = (process.env.BASE_PATH ?? "/").replace(/\\\/$/, "");';
const packageConstants = `

const CREDIT_PACKAGE_PRICE_IDS: Record<string, string> = {
  credits_300: "price_1TunXfAYtu5nLhAZ68ObRJ7Z",
  credits_700: "price_1TunYwAYtu5nLhAZwDmPGnis",
  credits_1500: "price_1TunaAAYtu5nLhAZqplDY2BB",
};

const CREATIVE_PACKAGE_PRICE_IDS: Record<string, string> = {
  creative_20: "price_1TunbfAYtu5nLhAZhuocDYRy",
  creative_35: "price_1TuncoAYtu5nLhAZbxixdrAd",
  creative_50: "price_1TundvAYtu5nLhAZBE4RJASZ",
};

const OFFICIAL_VIDEO_PACKAGE_PRICE_IDS: Record<string, string> = {
  video_10: "price_1TunidAYtu5nLhAZ4jIMKk3V",
  video_20: "price_1TunhwAYtu5nLhAZtAIPYFPX",
  video_30: "price_1TungXAYtu5nLhAZDHUOzXF9",
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

routes = routes.replace(
  /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/,
  `const VIDEO_PACKAGES = [
  { id: "video_10", videos: 10, unitAmountBrl: 3500, name: "Pacote 10 Vídeos com Efeito" },
  { id: "video_20", videos: 20, unitAmountBrl: 6500, name: "Pacote 20 Vídeos com Efeito" },
  { id: "video_30", videos: 30, unitAmountBrl: 9000, name: "Pacote 30 Vídeos com Efeito" },
] as const;`,
);

for (const marker of [
  'video_10: "price_1TunidAYtu5nLhAZ4jIMKk3V"',
  'video_20: "price_1TunhwAYtu5nLhAZtAIPYFPX"',
  'video_30: "price_1TungXAYtu5nLhAZDHUOzXF9"',
  'video_10: "price_1TyO8kAYtu5nLhAZFL8AJ8F9"',
  'video_20: "price_1TyOBZAYtu5nLhAZ2JqbZb09"',
  'video_30: "price_1TyOCZAYtu5nLhAZkTdXPnee"',
  'VIDEO_PACKAGE_CATALOG_MODE: "official" | "test" = "official"',
]) {
  if (!source.includes(marker)) throw new Error(`Video catalog marker missing: ${marker}`);
}
if (/id: "video_(5|7)"/.test(routes)) throw new Error("Legacy video packages are still active");

fs.writeFileSync(servicePath, source);
fs.writeFileSync(routePath, routes);
console.log("Official video catalog active; temporary R$ 0,50 video prices registered separately for later testing.");