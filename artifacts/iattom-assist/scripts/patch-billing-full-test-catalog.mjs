import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

source = source.replace(
  /const handleBillingRefresh\s*=\s*\(\)\s*=>\s*\{[^}]*\};/,
  `const handleBillingRefresh = () => { window.location.reload(); };`,
);

const creditBlock = `const CREDIT_PACKAGES = [
  { id: "credits_300",  credits: 300,  label: "300",   price: "R$ 0,50", tag: "Acessível", perUnit: "" },
  { id: "credits_700",  credits: 700,  label: "700",   price: "R$ 0,55", tag: "Vantagem", perUnit: "" },
  { id: "credits_1500", credits: 1500, label: "1.500", price: "R$ 0,60", tag: "Melhor Valor", perUnit: "" },
] as const;`;
if (!/const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/.test(source)) {
  throw new Error("[billing-full-test] credit package block not found");
}
source = source.replace(/const CREDIT_PACKAGES = \[[\s\S]*?\] as const;/, creditBlock);

source = source
  .replace(/(id: "creative_20"[^\n]*images: 20, price: ")[^"]+("[^\n]*)/g, `$1R$ 0,50$2`)
  .replace(/(id: "creative_35"[^\n]*images: 35, price: ")[^"]+("[^\n]*)/g, `$1R$ 0,55$2`)
  .replace(/(id: "creative_50"[^\n]*images: 50, price: ")[^"]+("[^\n]*)/g, `$1R$ 0,60$2`)
  .replaceAll(`tag: "CRIATIVO 20"`, `tag: "20 IMAGENS"`)
  .replaceAll(`tag: "CRIATIVO 35"`, `tag: "35 IMAGENS"`)
  .replaceAll(`tag: "CRIATIVO 50"`, `tag: "50 IMAGENS"`);

const mainPricePattern = /const getMainPrice\s*=\s*\(planKey: string\)\s*=>\s*\{[\s\S]*?\n\s*\};/;
if (!mainPricePattern.test(source)) throw new Error("[billing-full-test] plan price helper not found");
source = source.replace(
  mainPricePattern,
  `const getMainPrice = (planKey: string) => {
    if (planKey === "free") return "R$ 0";
    return "R$ 0,50";
  };`,
);

const videoStart = source.indexOf("{/* ── Pacotes de Vídeo");
const videoEnd = source.indexOf("{/* ── Referral CTA", videoStart);
if (videoStart < 0 || videoEnd < 0) throw new Error("[billing-full-test] video section boundaries not found");
let videoSection = source.slice(videoStart, videoEnd);

videoSection = videoSection
  .replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>")
  .replace(/ opacity-60 cursor-not-allowed/g, " transition-all duration-200")
  .replace(/\n\s*<div className="absolute inset-0 z-10 rounded-xl bg-black\/25 pointer-events-none" \/>/g, "")
  .replace(/\n\s*<div className="absolute top-3 right-3 z-20[\s\S]*?<Lock className="w-3 h-3" \/> Em breve\s*<\/div>/g, "")
  .replace(
    /<Button\s+size="sm"\s+className="w-full h-9 text-xs bg-white\/5 text-zinc-500 border border-white\/10 cursor-not-allowed"\s+disabled\s*>\s*<Lock className="w-3\.5 h-3\.5 mr-1\.5" \/> Em breve\s*<\/Button>/,
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

source = source.slice(0, videoStart) + videoSection + source.slice(videoEnd);

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

const finalVideoStart = source.indexOf("{/* ── Pacotes de Vídeo");
const finalVideoEnd = source.indexOf("{/* ── Referral CTA", finalVideoStart);
const finalVideoSection = source.slice(finalVideoStart, finalVideoEnd);
if (finalVideoSection.includes("Em breve") || finalVideoSection.includes("cursor-not-allowed")) {
  throw new Error("[billing-full-test] video checkout remains locked");
}

writeFileSync(billingUrl, source);
console.log("Full billing test catalog active; refresh performs a literal browser reload; video package checkout unlocked.");
