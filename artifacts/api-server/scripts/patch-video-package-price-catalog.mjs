import { readFileSync, writeFileSync } from "node:fs";

const stripeRouteUrl = new URL("../src/routes/stripe.ts", import.meta.url);
const stripeServiceUrl = new URL("../src/lib/stripeService.ts", import.meta.url);

let route = readFileSync(stripeRouteUrl, "utf8");
let service = readFileSync(stripeServiceUrl, "utf8");

const videoPackages = `const VIDEO_PACKAGES = [
  {
    id: "video_10",
    videos: 10,
    unitAmountBrl: 5990,
    name: "Pacote 10 Vídeos com Efeito",
    priceId: "price_1U0EDAAYtu5nLhAZpWhOVTvB",
  },
  {
    id: "video_20",
    videos: 20,
    unitAmountBrl: 8990,
    name: "Pacote 20 Vídeos com Efeito",
    priceId: "price_1U0EEMAYtu5nLhAZj1VLUXRM",
  },
  {
    id: "video_30",
    videos: 30,
    unitAmountBrl: 11990,
    name: "Pacote 30 Vídeos com Efeito",
    priceId: "price_1U0EFGAYtu5nLhAZgTswLJlM",
  },
] as const;`;

const packagePattern = /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/;
if (!packagePattern.test(route)) throw new Error("Video package catalog not found");
route = route.replace(packagePattern, videoPackages);

const checkoutPattern = /      const url = await createVideoPackCheckoutSession\(\n        clerkUserId,\n        pkg\.id,\n        pkg\.videos,\n        pkg\.(?:unitAmountBrl|officialPriceId|testPriceId|priceId),\n        pkg\.name,\n      \);/;
if (!checkoutPattern.test(route)) throw new Error("Video checkout call marker not found");
route = route.replace(
  checkoutPattern,
  `      const url = await createVideoPackCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.videos,
        pkg.priceId,
        pkg.name,
      );`,
);

const videoFunctionPattern = /export async function createVideoPackCheckoutSession\([\s\S]*?\n}\n/;
const videoFunctionMatch = service.match(videoFunctionPattern);
if (!videoFunctionMatch) throw new Error("Video checkout service function not found");

let videoFunction = videoFunctionMatch[0];
videoFunction = videoFunction.replace(
  /\bunitAmountBrl:\s*number,/,
  "priceId: string,",
);

const lineItemsPattern = /line_items:\s*\[[\s\S]*?\],\s*mode:\s*"payment",/;
if (!lineItemsPattern.test(videoFunction)) {
  throw new Error("Video checkout line_items block not found");
}
videoFunction = videoFunction.replace(
  lineItemsPattern,
  'line_items: [{ price: priceId, quantity: 1 }],\n    mode: "payment",',
);

if (!/priceId:\s*string/.test(videoFunction)) {
  throw new Error("Video checkout parameter was not changed to priceId");
}
if (!/line_items:\s*\[\{\s*price:\s*priceId,\s*quantity:\s*1\s*\}\]/.test(videoFunction)) {
  throw new Error("Video checkout line item is not using the registered Price ID");
}
if (/unitAmountBrl|price_data:/.test(videoFunction)) {
  throw new Error("Video checkout still contains dynamic amount data");
}

service = service.replace(videoFunctionPattern, videoFunction);

for (const marker of [
  'priceId: "price_1U0EDAAYtu5nLhAZpWhOVTvB"',
  'priceId: "price_1U0EEMAYtu5nLhAZj1VLUXRM"',
  'priceId: "price_1U0EFGAYtu5nLhAZgTswLJlM"',
  "pkg.priceId",
]) {
  if (!route.includes(marker)) throw new Error(`Video catalog validation failed: ${marker}`);
}
if (/price_1TyO8kAYtu5nLhAZFL8AJ8F9|price_1TyOBZAYtu5nLhAZ2JqbZb09|price_1TyOCZAYtu5nLhAZkTdXPnee/.test(route)) {
  throw new Error("Temporary video Price IDs remain active");
}
if (/id: "video_(5|7)"/.test(route)) throw new Error("Legacy video packages remain in API catalog");

writeFileSync(stripeRouteUrl, route);
writeFileSync(stripeServiceUrl, service);
console.log("Video checkout uses only official Stripe Price IDs.");
