import { readFileSync, writeFileSync } from "node:fs";

const stripeRouteUrl = new URL("../src/routes/stripe.ts", import.meta.url);
const stripeServiceUrl = new URL("../src/lib/stripeService.ts", import.meta.url);

let route = readFileSync(stripeRouteUrl, "utf8");
let service = readFileSync(stripeServiceUrl, "utf8");

const videoPackages = `const VIDEO_PACKAGES = [
  {
    id: "video_10",
    videos: 10,
    unitAmountBrl: 3500,
    name: "Pacote 10 Vídeos com Efeito",
    officialPriceId: "price_1TunidAYtu5nLhAZ4jIMKk3V",
    testPriceId: "price_1TyO8kAYtu5nLhAZFL8AJ8F9",
  },
  {
    id: "video_20",
    videos: 20,
    unitAmountBrl: 6500,
    name: "Pacote 20 Vídeos com Efeito",
    officialPriceId: "price_1TunhwAYtu5nLhAZtAIPYFPX",
    testPriceId: "price_1TyOBZAYtu5nLhAZ2JqbZb09",
  },
  {
    id: "video_30",
    videos: 30,
    unitAmountBrl: 9000,
    name: "Pacote 30 Vídeos com Efeito",
    officialPriceId: "price_1TungXAYtu5nLhAZDHUOzXF9",
    testPriceId: "price_1TyOCZAYtu5nLhAZkTdXPnee",
  },
] as const;`;

const packagePattern = /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/;
if (!packagePattern.test(route)) throw new Error("Video package catalog not found");
route = route.replace(packagePattern, videoPackages);

const checkoutPattern = /      const url = await createVideoPackCheckoutSession\(\n        clerkUserId,\n        pkg\.id,\n        pkg\.videos,\n        pkg\.(?:unitAmountBrl|officialPriceId|testPriceId),\n        pkg\.name,\n      \);/;
if (!checkoutPattern.test(route)) throw new Error("Video checkout call marker not found");
route = route.replace(
  checkoutPattern,
  `      const url = await createVideoPackCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.videos,
        pkg.officialPriceId,
        pkg.name,
      );`,
);

service = service.replace(
  `  videos: number,\n  unitAmountBrl: number,\n  packageName: string,`,
  `  videos: number,\n  priceId: string,\n  packageName: string,`,
);

const priceDataBlock = `      {
        price_data: {
          currency: "brl",
          unit_amount: unitAmountBrl,
          product_data: {
            name: packageName,
            description: \`${"${videos}"} vídeo${"${videos !== 1 ? \"s\" : \"\"}"} — compra avulsa (não expiram)\`,
          },
        },
        quantity: 1,
      },`;
const priceIdBlock = `      { price: priceId, quantity: 1 },`;
if (service.includes(priceDataBlock)) {
  service = service.replace(priceDataBlock, priceIdBlock);
} else if (!service.includes("{ price: priceId, quantity: 1 }")) {
  throw new Error("Video Stripe line item marker not found");
}

for (const marker of [
  'officialPriceId: "price_1TunidAYtu5nLhAZ4jIMKk3V"',
  'officialPriceId: "price_1TunhwAYtu5nLhAZtAIPYFPX"',
  'officialPriceId: "price_1TungXAYtu5nLhAZDHUOzXF9"',
  "pkg.officialPriceId",
]) {
  if (!route.includes(marker)) throw new Error(`Video catalog validation failed: ${marker}`);
}
if (route.includes("pkg.testPriceId,")) throw new Error("Test video prices are still active");
if (/id: "video_(5|7)"/.test(route)) throw new Error("Legacy video packages remain in API catalog");
if (!service.includes("priceId: string") || !service.includes("{ price: priceId, quantity: 1 }")) {
  throw new Error("Stripe video checkout is not using a registered Price ID");
}

writeFileSync(stripeRouteUrl, route);
writeFileSync(stripeServiceUrl, service);
console.log("Official video Stripe Price IDs active: R$ 35,00, R$ 65,00 and R$ 90,00.");
