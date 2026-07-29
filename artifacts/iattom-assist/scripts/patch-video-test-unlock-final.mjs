import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);

let creative = readFileSync(creativeUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");

const videoPackages = `const VIDEO_PACKAGES = [
  {
    id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 0,50",
    bg: "bg-[#060a10]",
    border: "border-blue-400/20 hover:border-blue-400/35",
    topLine: "via-blue-400/25",
    ambient: "from-blue-500/[0.03]",
    badge: "bg-blue-500/10 text-blue-300 border border-blue-400/20 border-t-0",
    iconBg: "bg-blue-500/12 border border-blue-400/20",
    iconColor: "text-blue-300",
    labelColor: "text-blue-300",
    btn: "bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 border border-blue-400/25",
  },
  {
    id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 0,50",
    bg: "bg-[#0a080e]",
    border: "border-violet-500/50 shadow-[0_0_36px_-6px_rgba(139,92,246,0.22)] hover:shadow-[0_0_44px_-6px_rgba(139,92,246,0.30)]",
    topLine: "via-violet-400/70",
    ambient: "from-violet-500/[0.06]",
    badge: "bg-violet-600 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
    iconBg: "bg-violet-500/15 border border-violet-500/30",
    iconColor: "text-violet-400",
    labelColor: "text-violet-400",
    btn: "bg-violet-600 text-white hover:bg-violet-500 font-bold",
  },
  {
    id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 0,50",
    bg: "bg-[#050e09]",
    border: "border-emerald-500/30 hover:border-emerald-500/45 shadow-[0_0_36px_-4px_rgba(16,185,129,0.16)]",
    topLine: "via-emerald-400/50",
    ambient: "from-emerald-500/[0.04]",
    badge: "bg-emerald-600 text-white",
    iconBg: "bg-emerald-500/10 border border-emerald-500/25",
    iconColor: "text-emerald-400",
    labelColor: "text-emerald-400",
    btn: "bg-emerald-600 text-white hover:bg-emerald-500 font-bold",
  },
] as const;`;

const packagePattern = /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/;
if (!packagePattern.test(billing)) throw new Error("Final video package block not found");
billing = billing.replace(packagePattern, videoPackages);

billing = billing.replace(
  /  const handleBuyVideoPack = async \(packId: string\) => \{\n(?:    if \(currentPlan === "free"\) \{\n      setShowComparison\(true\);\n      return;\n    \}\n)?    setVideoPending\(packId\);/,
  `  const handleBuyVideoPack = async (packId: string) => {\n    setVideoPending(packId);`,
);

creative = creative.replace(
  /if \(!isAdmin && !\["pro", "business", "agency"\]\.includes\(planSlug\)\) return <ModuleLockGate allowedPlans=\{\["pro", "business", "agency"\]\} moduleName="Criar Imagem e Vídeo" \/>;/,
  `if (false && !isAdmin && !["pro", "business", "agency"].includes(planSlug)) return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Imagem e Vídeo" />;`,
);

const ids = [...billing.matchAll(/id: "(video_\d+)"/g)].map((match) => match[1]);
const expectedIds = ["video_10", "video_20", "video_30"];
if (ids.length !== expectedIds.length || new Set(ids).size !== expectedIds.length) {
  throw new Error(`Video package IDs are duplicated or incomplete: ${ids.join(", ")}`);
}
for (const id of expectedIds) {
  if (!ids.includes(id)) throw new Error(`Missing final video package: ${id}`);
}

for (const marker of [
  `id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 0,50"`,
  `id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 0,50"`,
  `id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 0,50"`,
  `if (false && !isAdmin`,
]) {
  if (!(billing + creative).includes(marker)) {
    throw new Error(`Final video test validation missing: ${marker}`);
  }
}

const videoSectionStart = billing.indexOf("{VIDEO_PACKAGES.map((pkg) => {");
const videoSectionEnd = billing.indexOf("{/* ── Referral CTA", videoSectionStart);
if (videoSectionStart < 0 || videoSectionEnd <= videoSectionStart) {
  throw new Error("Final video package section not found");
}
const finalVideoSection = billing.slice(videoSectionStart, videoSectionEnd);
if (/Em breve|cursor-not-allowed/.test(finalVideoSection)) {
  throw new Error("Final video package checkout remains visually locked");
}

if (/id: "video_(5|7)"/.test(billing)) throw new Error("Legacy video packages remain visible");
if (billing.includes("Pacotes de Vídeo</p>")) {
  billing = billing.replaceAll("Pacotes de Vídeo</p>", "Pacotes de Vídeo com Efeito</p>");
}

writeFileSync(creativeUrl, creative);
writeFileSync(billingUrl, billing);
console.log("Final video test state consolidated: unique 10/20/30 cards, checkout enabled and module access unlocked.");