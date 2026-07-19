import fs from "node:fs";

const path = new URL("../src/lib/stripeService.ts", import.meta.url);
let source = fs.readFileSync(path, "utf8");

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

const VIDEO_PACKAGE_PRICE_IDS: Record<string, string> = {
  video_5: "price_1TungXAYtu5nLhAZDHUOzXF9",
  video_7: "price_1TunhwAYtu5nLhAZtAIPYFPX",
  video_10: "price_1TunidAYtu5nLhAZ4jIMKk3V",
};`;

if (!source.includes("CREDIT_PACKAGE_PRICE_IDS")) {
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

fs.writeFileSync(path, source);
console.log("Official Stripe catalog package prices applied");
