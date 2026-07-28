import { readFileSync, writeFileSync } from "node:fs";

const historyUrl = new URL("../src/pages/dashboard/History.tsx", import.meta.url);
let historySource = readFileSync(historyUrl, "utf8");

historySource = historySource
  .replace('creative: "criativo",', 'creative: "imagem",')
  .replace('  marketing: "marketing",\n};', '  marketing: "marketing",\n  video_effect: "vídeo com efeito",\n  prompts: "prompt",\n  help: "IAttom Help",\n};')
  .replace('  marketing: FolderOpen,\n};', '  marketing: FolderOpen,\n  video_effect: Video,\n  prompts: Sparkles,\n  help: Clock,\n};')
  .replace('  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",\n};', '  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",\n  video_effect: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",\n  prompts: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",\n  help: "text-zinc-300 bg-white/[0.05] border-white/[0.08]",\n};')
  .replace('    <div className="space-y-8">', '    <div className="flex min-h-0 flex-col gap-8 lg:h-[calc(100dvh-7rem)]">')
  .replace('      <div className={`transition-opacity duration-150 ${isFetching && !isLoading ? "opacity-50 pointer-events-none" : ""}`}>', '      <div className={`min-h-0 max-h-[65dvh] flex-1 overflow-y-auto overscroll-contain pr-1 pb-4 transition-opacity duration-150 lg:max-h-none ${isFetching && !isLoading ? "opacity-50 pointer-events-none" : ""}`}>');

const historyMarkers = [
  'lg:h-[calc(100dvh-7rem)]',
  'max-h-[65dvh] flex-1 overflow-y-auto overscroll-contain',
  'video_effect: "vídeo com efeito"',
  'creative: "imagem"',
];
for (const marker of historyMarkers) {
  if (!historySource.includes(marker)) throw new Error(`History marker missing: ${marker}`);
}
writeFileSync(historyUrl, historySource);

const analyticsUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let analyticsSource = readFileSync(analyticsUrl, "utf8");

analyticsSource = analyticsSource
  .replace('  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },\n};', '  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },\n  video_effect: { label: "Vídeo com Efeito", color: "#E879F9", icon: Video },\n  prompts: { label: "Prompt", color: "#22D3EE", icon: Sparkles },\n  help: { label: "IAttom Help", color: "#A1A1AA", icon: Zap },\n};')
  .replace('<div className="space-y-2">\n              {data.recentHistory.map((item) => {', '<div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">\n              {data.recentHistory.map((item) => {');

const analyticsMarkers = [
  'label: "Vídeo com Efeito"',
  'label: "IAttom Help"',
  'max-h-72 space-y-2 overflow-y-auto overscroll-contain',
];
for (const marker of analyticsMarkers) {
  if (!analyticsSource.includes(marker)) throw new Error(`Analytics marker missing: ${marker}`);
}
writeFileSync(analyticsUrl, analyticsSource);

console.log("Activities and analytics keep their design, add module labels, and use internal scrolling.");
