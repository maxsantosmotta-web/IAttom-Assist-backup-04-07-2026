import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[billing-full-test] ${label}: marker not found`);
  source = source.replace(before, after);
}

replaceRequired(
  `  const handleBillingRefresh = () => { void refetchPlans(); void refetchSub(); void refetchMe(); void refetchCredits(); };`,
  `  const handleBillingRefresh = () => { window.location.reload(); };`,
  "real page refresh",
);

source = source
  .replace(`{ id: "credits_300",  credits: 300,  label: "300",   price: "R$ 39,90",  tag: "Acessível",   perUnit: "" }`, `{ id: "credits_300",  credits: 300,  label: "300",   price: "R$ 0,50", tag: "Acessível", perUnit: "" }`)
  .replace(`{ id: "credits_700",  credits: 700,  label: "700",   price: "R$ 79,90",  tag: "Vantagem",    perUnit: "" }`, `{ id: "credits_700",  credits: 700,  label: "700",   price: "R$ 0,55", tag: "Vantagem", perUnit: "" }`)
  .replace(`{ id: "credits_1500", credits: 1500, label: "1.500", price: "R$ 149,90", tag: "Melhor Valor", perUnit: "" }`, `{ id: "credits_1500", credits: 1500, label: "1.500", price: "R$ 0,60", tag: "Melhor Valor", perUnit: "" }`)
  .replaceAll(`id: "creative_20", tag: "20 IMAGENS", images: 20, price: "R$ 47,00"`, `id: "creative_20", tag: "20 IMAGENS", images: 20, price: "R$ 0,50"`)
  .replaceAll(`id: "creative_35", tag: "35 IMAGENS", images: 35, price: "R$ 79,00"`, `id: "creative_35", tag: "35 IMAGENS", images: 35, price: "R$ 0,55"`)
  .replaceAll(`id: "creative_50", tag: "50 IMAGENS", images: 50, price: "R$ 89,00"`, `id: "creative_50", tag: "50 IMAGENS", images: 50, price: "R$ 0,60"`)
  .replaceAll(`id: "creative_20", tag: "CRIATIVO 20", images: 20, price: "R$ 47,00"`, `id: "creative_20", tag: "20 IMAGENS", images: 20, price: "R$ 0,50"`)
  .replaceAll(`id: "creative_35", tag: "CRIATIVO 35", images: 35, price: "R$ 79,00"`, `id: "creative_35", tag: "35 IMAGENS", images: 35, price: "R$ 0,55"`)
  .replaceAll(`id: "creative_50", tag: "CRIATIVO 50", images: 50, price: "R$ 89,00"`, `id: "creative_50", tag: "50 IMAGENS", images: 50, price: "R$ 0,60"`);

replaceRequired(
  `  const getMainPrice = (planKey: string) => {
    const p = PLAN_PRICES[planKey];
    if (!p) return "—";
    return billing === "annual" ? p.yearlyDisplay : p.monthlyDisplay;
  };`,
  `  const getMainPrice = (planKey: string) => {
    if (planKey === "free") return "R$ 0";
    return "R$ 0,50";
  };`,
  "test plan display",
);

const lockedCard = `              <div
                key={pkg.id}
                className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 opacity-60 cursor-not-allowed \${pkg.bg} \${pkg.border}\`}
              >
                <div className="absolute inset-0 z-10 rounded-xl bg-black/25 pointer-events-none" />
                <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold text-zinc-300">
                  <Lock className="w-3 h-3" /> Em breve
                </div>`;
const openCard = `              <div
                key={pkg.id}
                className={\`relative flex flex-col rounded-xl border pt-8 px-5 pb-5 transition-all duration-200 \${pkg.bg} \${pkg.border}\`}
              >`;
replaceRequired(lockedCard, openCard, "unlock video cards");

const lockedButton = `                <Button
                  size="sm"
                  className="w-full h-9 text-xs bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"
                  disabled
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve
                </Button>`;
const buyButton = `                <Button
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
replaceRequired(lockedButton, buyButton, "unlock video checkout");

source = source.replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>");

for (const marker of [
  `const handleBillingRefresh = () => { window.location.reload(); };`,
  `return "R$ 0,50";`,
  `price: "R$ 0,50"`,
  `price: "R$ 0,55"`,
  `price: "R$ 0,60"`,
  `onClick={() => handleBuyVideoPack(pkg.id)}`,
  `Pacotes de Vídeo com Efeito`,
]) {
  if (!source.includes(marker)) throw new Error(`[billing-full-test] validation failed: ${marker}`);
}
if (source.includes(`<Lock className="w-3.5 h-3.5 mr-1.5" /> Em breve`)) {
  throw new Error("[billing-full-test] video checkout remains locked");
}

writeFileSync(billingUrl, source);
console.log("Full billing test catalog active; refresh performs a literal browser reload; video package checkout unlocked.");
