import { readFileSync, writeFileSync } from "node:fs";

const creditsPageUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let creditsPage = readFileSync(creditsPageUrl, "utf8");

creditsPage = creditsPage
  .replace(
    `  const upgradePlans = balance
    ? (Object.keys(PLAN_CREDITS) as Array<keyof typeof PLAN_CREDITS>).filter(
        (p) => PLAN_CREDITS[p] > (PLAN_CREDITS[balance.plan as keyof typeof PLAN_CREDITS] ?? 0),
      )
    : [];`,
    `  const PLAN_HIERARCHY = ["free", "pro", "business", "agency"] as const;
  const currentPlanKey = (balance?.plan && PLAN_HIERARCHY.includes(balance.plan as typeof PLAN_HIERARCHY[number]))
    ? balance.plan as typeof PLAN_HIERARCHY[number]
    : "free";
  const currentPlanIndex = PLAN_HIERARCHY.indexOf(currentPlanKey);
  const upgradePlans = PLAN_HIERARCHY.slice(currentPlanIndex + 1);`,
  )
  .replace(
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "START", pro: "COMPLETO", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = balance?.plan ? (PLAN_DISPLAY_NAMES[balance.plan] ?? balance.plan) : "START";`,
    `  const PLAN_DISPLAY_NAMES: Record<string, string> = { free: "FREE", pro: "START", business: "PREMIUM", agency: "PRO" };
  const currentPlanDisplay = PLAN_DISPLAY_NAMES[currentPlanKey];`,
  );

writeFileSync(creditsPageUrl, creditsPage);

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let billing = readFileSync(billingUrl, "utf8");

const testVideoPackages = `const VIDEO_PACKAGES = [
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

const videoBlockPattern = /const VIDEO_PACKAGES = \[[\s\S]*?\] as const;/;
if (!videoBlockPattern.test(billing)) throw new Error("Video package block not found");
billing = billing.replace(videoBlockPattern, testVideoPackages);

for (const marker of [
  'id: "video_10", tag: "PACK 10", videos: 10, price: "R$ 0,50"',
  'id: "video_20", tag: "PACK 20", videos: 20, price: "R$ 0,50"',
  'id: "video_30", tag: "PACK 30", videos: 30, price: "R$ 0,50"',
]) {
  if (!billing.includes(marker)) throw new Error(`Test video display missing: ${marker}`);
}
if (/id: "video_(5|7)"/.test(billing)) throw new Error("Legacy video cards are still visible");

writeFileSync(billingUrl, billing);

await import("./patch-plan-media-package-labels.mjs");

console.log("Temporary R$ 0,50 video package prices displayed; official prices remain preserved in backend catalog.");
