import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
const creditsUrl = new URL("../src/lib/credits.ts", import.meta.url);
let billing = readFileSync(billingUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

billing = billing.replace(
  /const handleBillingRefresh\s*=\s*\(\)\s*=>\s*\{[^}]*\};/,
  `const handleBillingRefresh = () => { window.location.reload(); };`,
);

const creditPackages = `const CREDIT_PACKAGES = [
  { id: "credits_300",  credits: 300,  label: "300",   price: "R$ 0,50", tag: "Acessível", perUnit: "" },
  { id: "credits_700",  credits: 700,  label: "700",   price: "R$ 0,55", tag: "Vantagem", perUnit: "" },
  { id: "credits_1500", credits: 1500, label: "1.500", price: "R$ 0,60", tag: "Melhor Valor", perUnit: "" },
] as const;`;
billing = billing.replace(/const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/, creditPackages);

billing = billing
  .replace(/(id: "creative_20"[^\n]*price: ")[^"]+("[^\n]*)/g, `$1R$ 0,50$2`)
  .replace(/(id: "creative_35"[^\n]*price: ")[^"]+("[^\n]*)/g, `$1R$ 0,55$2`)
  .replace(/(id: "creative_50"[^\n]*price: ")[^"]+("[^\n]*)/g, `$1R$ 0,60$2`)
  .replaceAll(`tag: "CRIATIVO 20"`, `tag: "20 IMAGENS"`)
  .replaceAll(`tag: "CRIATIVO 35"`, `tag: "35 IMAGENS"`)
  .replaceAll(`tag: "CRIATIVO 50"`, `tag: "50 IMAGENS"`)
  .replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>");

credits = credits
  .replace(/monthlyDisplay: "R\$69\/mês"/, `monthlyDisplay: "R$ 0,50/mês"`)
  .replace(/yearlyDisplay: "R\$697\/ano"/, `yearlyDisplay: "R$ 0,50/ano"`)
  .replace(/yearlyMonthlyDisplay: "R\$58,08\/mês"/, `yearlyMonthlyDisplay: "R$ 0,50/mês"`)
  .replace(/monthlyDisplay: "R\$159\/mês"/, `monthlyDisplay: "R$ 0,50/mês"`)
  .replace(/yearlyDisplay: "R\$1\.565\/ano"/, `yearlyDisplay: "R$ 0,50/ano"`)
  .replace(/yearlyMonthlyDisplay: "R\$130,42\/mês"/, `yearlyMonthlyDisplay: "R$ 0,50/mês"`)
  .replace(/monthlyDisplay: "R\$299\/mês"/, `monthlyDisplay: "R$ 0,50/mês"`)
  .replace(/yearlyDisplay: "R\$2\.870\/ano"/, `yearlyDisplay: "R$ 0,50/ano"`)
  .replace(/yearlyMonthlyDisplay: "R\$239,20\/mês"/, `yearlyMonthlyDisplay: "R$ 0,50/mês"`);

const videoMapStart = billing.indexOf("{VIDEO_PACKAGES.map((pkg) => {");
const videoSectionEnd = billing.indexOf("{/* ── Referral CTA", videoMapStart);
if (videoMapStart < 0 || videoSectionEnd < 0) {
  throw new Error("[billing-full-test] video package section not found");
}
let video = billing.slice(videoMapStart, videoSectionEnd);
video = video
  .replaceAll(" opacity-60 cursor-not-allowed", " transition-all duration-200")
  .replace(/\n\s*<div className="absolute inset-0 z-10 rounded-xl bg-black\/25 pointer-events-none" \/>/g, "")
  .replace(/\n\s*<div className="absolute top-3 right-3 z-20[\s\S]*?<Lock className="w-3 h-3" \/> Em breve\s*<\/div>/g, "")
  .replace(
    /<Button[\s\S]*?className="w-full h-9 text-xs bg-white\/5 text-zinc-500 border border-white\/10 cursor-not-allowed"[\s\S]*?<Lock className="w-3\.5 h-3\.5 mr-1\.5" \/> Em breve[\s\S]*?<\/Button>/,
    `<Button
                  size="sm"
                  className={\`w-full h-9 text-xs \${pkg.btn}\`}
                  onClick={() => handleBuyVideoPack(pkg.id)}
                  disabled={isPending || videoPending !== null}
                >
                  {isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aguarde...</>
                    : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Comprar</>
                  }
                </Button>`,
  );
billing = billing.slice(0, videoMapStart) + video + billing.slice(videoSectionEnd);

for (const marker of [
  `const handleBillingRefresh = () => { window.location.reload(); };`,
  `price: "R$ 0,50"`,
  `price: "R$ 0,55"`,
  `price: "R$ 0,60"`,
  `onClick={() => handleBuyVideoPack(pkg.id)}`,
  `Pacotes de Vídeo com Efeito`,
]) {
  if (!billing.includes(marker)) throw new Error(`[billing-full-test] billing validation failed: ${marker}`);
}
if (!credits.includes(`monthlyDisplay: "R$ 0,50/mês"`) || !credits.includes(`yearlyDisplay: "R$ 0,50/ano"`)) {
  throw new Error("[billing-full-test] plan test prices were not applied");
}
const finalVideo = billing.slice(billing.indexOf("{VIDEO_PACKAGES.map((pkg) => {"), billing.indexOf("{/* ── Referral CTA"));
if (finalVideo.includes("Em breve") || finalVideo.includes("cursor-not-allowed")) {
  throw new Error("[billing-full-test] video package checkout remains locked");
}

writeFileSync(billingUrl, billing);
writeFileSync(creditsUrl, credits);
console.log("All billing test prices are visible; refresh reloads the browser; video package checkout is unlocked.");
