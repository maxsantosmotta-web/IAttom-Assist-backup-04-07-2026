import { readFileSync, writeFileSync } from "node:fs";

const stripeRouteUrl = new URL("../src/routes/stripe.ts", import.meta.url);
const stripeServiceUrl = new URL("../src/lib/stripeService.ts", import.meta.url);

let route = readFileSync(stripeRouteUrl, "utf8");
let service = readFileSync(stripeServiceUrl, "utf8");

const officialPackages = `const VIDEO_PACKAGES = [
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
route = route.replace(packagePattern, officialPackages);

const oldCheckoutCall = `      const url = await createVideoPackCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.videos,
        pkg.unitAmountBrl,
        pkg.name,
      );`;
const newCheckoutCall = `      const url = await createVideoPackCheckoutSession(
        clerkUserId,
        pkg.id,
        pkg.videos,
        pkg.officialPriceId,
        pkg.name,
      );`;
if (route.includes(oldCheckoutCall)) {
  route = route.replace(oldCheckoutCall, newCheckoutCall);
} else if (!route.includes("pkg.officialPriceId")) {
  throw new Error("Video checkout call marker not found");
}

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
  'id: "video_10"',
  'videos: 10',
  'unitAmountBrl: 3500',
  'officialPriceId: "price_1TunidAYtu5nLhAZ4jIMKk3V"',
  'testPriceId: "price_1TyO8kAYtu5nLhAZFL8AJ8F9"',
  'id: "video_20"',
  'videos: 20',
  'unitAmountBrl: 6500',
  'officialPriceId: "price_1TunhwAYtu5nLhAZtAIPYFPX"',
  'testPriceId: "price_1TyOBZAYtu5nLhAZ2JqbZb09"',
  'id: "video_30"',
  'videos: 30',
  'unitAmountBrl: 9000',
  'officialPriceId: "price_1TungXAYtu5nLhAZDHUOzXF9"',
  'testPriceId: "price_1TyOCZAYtu5nLhAZkTdXPnee"',
  "pkg.officialPriceId",
]) {
  if (!route.includes(marker)) throw new Error(`Video catalog validation failed: ${marker}`);
}
if (/id: "video_(5|7)"/.test(route)) throw new Error("Legacy video packages remain in API catalog");
if (!service.includes("priceId: string") || !service.includes("{ price: priceId, quantity: 1 }")) {
  throw new Error("Stripe video checkout is not using a registered Price ID");
}
if (service.includes("unit_amount: unitAmountBrl") && service.includes("createVideoPackCheckoutSession")) {
  const fn = service.slice(service.indexOf("export async function createVideoPackCheckoutSession"), service.indexOf("export async function createFreeStartCheckoutSession"));
  if (fn.includes("unit_amount: unitAmountBrl")) throw new Error("Video checkout still creates dynamic prices");
}

writeFileSync(stripeRouteUrl, route);
writeFileSync(stripeServiceUrl, service);
console.log("Official video package Price IDs active; test Price IDs registered but inactive.");
