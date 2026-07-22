import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

const priceMapMarker = "const STRIPE_BILLING_PRICE_IDS";
if (!source.includes(priceMapMarker)) {
  const insertAfter = `const IMAGE_PACKAGES = [`;
  const index = source.indexOf(insertAfter);
  if (index === -1) throw new Error("IMAGE_PACKAGES marker not found");
  const map = `const STRIPE_BILLING_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: "price_1TvgAOAYtu5nLhAZmgqhsTxJ",
    annual: "price_1TvgDBAYtu5nLhAZsgenq5SJ",
  },
  business: {
    monthly: "price_1TvgEwAYtu5nLhAZvWozumfH",
    annual: "price_1TvgFWAYtu5nLhAZuT001wT5",
  },
  agency: {
    monthly: "price_1TvgGHAYtu5nLhAZt4gYmBM5",
    annual: "price_1TvgGgAYtu5nLhAZO8FYa6nK",
  },
};

`;
  source = source.slice(0, index) + map + source.slice(index);
}

const oldCheckout = `    checkout.mutate({ data: { priceId: priceId ?? "free", planKey } });`;
const newCheckout = `    const officialPriceId = STRIPE_BILLING_PRICE_IDS[planKey]?.[billing];
    const selectedPriceId = officialPriceId ?? priceId;
    if (!selectedPriceId) {
      toast({ title: "Preço indisponível", description: "O plano selecionado ainda não está disponível para compra.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: selectedPriceId, planKey }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? \`HTTP \${response.status}\`);
      }
      if (!payload.url) {
        throw new Error("Checkout sem URL de redirecionamento");
      }
      window.location.href = payload.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Não foi possível iniciar o upgrade", description: message, variant: "destructive" });
    }`;
if (source.includes(oldCheckout)) {
  source = source.replace(oldCheckout, newCheckout);
} else if (!source.includes('fetch("/api/stripe/checkout"')) {
  throw new Error("Billing checkout handler marker not found");
}

const imageStart = source.indexOf("{/* ── Pacotes de Imagem (Criativos)");
const videoStart = source.indexOf("{/* ── Pacotes de Vídeo", imageStart);
if (imageStart === -1 || videoStart === -1) throw new Error("Package section markers not found");

let imageSection = source.slice(imageStart, videoStart);
imageSection = imageSection.replace(
  `className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 opacity-60 cursor-not-allowed \${pkg.bg} \${pkg.border}\`}
              >
                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />
                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">
                  <Lock className="w-3 h-3" /> Em breve
                </div>`,
  `className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 \${pkg.bg} \${pkg.border}\`}
              >`,
);
imageSection = imageSection.replace(
  `                <Button
                  size="sm"
                  className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"
                  disabled
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`,
  `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyImagePack(pkg.id)}
                  disabled={isPending || imagePending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`,
);
source = source.slice(0, imageStart) + imageSection + source.slice(videoStart);

const refreshedVideoStart = source.indexOf("{/* ── Pacotes de Vídeo");
const videoEnd = source.indexOf("{/* ── Referral CTA", refreshedVideoStart);
if (refreshedVideoStart === -1 || videoEnd === -1) throw new Error("Video section boundaries not found");
let videoSection = source.slice(refreshedVideoStart, videoEnd);

const activeVideoButton = `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyVideoPack(pkg.id)}
                  disabled={isPending || videoPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`;
const brightLockedVideoButton = `                <Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn} opacity-100 cursor-not-allowed\`}
                  disabled
                  aria-disabled="true"
                  title="Pacotes de vídeo em breve"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`;
if (videoSection.includes(activeVideoButton)) {
  videoSection = videoSection.replace(activeVideoButton, brightLockedVideoButton);
} else {
  videoSection = videoSection.replace(
    `className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"`,
    `className={\`w-full h-9 text-xs \${pkg.btn} opacity-100 cursor-not-allowed\`}`,
  );
}
videoSection = videoSection
  .replace("opacity-60 cursor-not-allowed", "transition-all duration-200")
  .replace(`                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />\n`, "")
  .replace(`                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">\n                  <Lock className="w-3 h-3" /> Em breve\n                </div>\n`, "");
source = source.slice(0, refreshedVideoStart) + videoSection + source.slice(videoEnd);

writeFileSync(billingUrl, source);

// Execute the temporary live billing patch at the end of an already-existing
// build step so package.json and pnpm-lock.yaml remain untouched.
await import("./patch-temporary-billing-test.mjs");

console.log("Billing checkout now sends the exact backend JSON body directly; temporary prices and credit tests remain enabled.");
