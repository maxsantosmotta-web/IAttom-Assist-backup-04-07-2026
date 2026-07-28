import { readFileSync, writeFileSync } from "node:fs";

const analyticsUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let source = readFileSync(analyticsUrl, "utf8");

source = source.replace(
  '  validate_products: { label: "Validar", color: "#34D399", icon: CheckCircle },\n  product_validation: { label: "Validar", color: "#34D399", icon: CheckCircle },',
  '  validate_products: { label: "Validar Produto", color: "#34D399", icon: CheckCircle },\n  product_validation: { label: "Validar Produto", color: "#34D399", icon: CheckCircle },',
);

if (!source.includes('video_effect: { label: "Vídeo com Efeito"')) {
  source = source.replace(
    '  video_script: { label: "Script de Vídeo", color: "#FB7185", icon: Video },',
    '  video_script: { label: "Script de Vídeo", color: "#FB7185", icon: Video },\n  video_effect: { label: "Vídeo com Efeito", color: "#22D3EE", icon: Video },',
  );
}

const oldChart = `  const chartModules = data?.activityByModule
    .map((item) => ({
      ...item,
      label: MODULE_META[item.module]?.label ?? item.module,
      color: MODULE_META[item.module]?.color ?? "#666",
    }))
    .sort((a, b) => b.count - a.count) ?? [];`;

const newChart = `  const canonicalModules = [
    { key: "find_products", aliases: ["find_products", "product_discovery"] },
    { key: "validate_products", aliases: ["validate_products", "product_validation"] },
    { key: "campaign", aliases: ["campaign"] },
    { key: "content", aliases: ["content"] },
    { key: "creative", aliases: ["creative"] },
    { key: "video_script", aliases: ["video_script"] },
    { key: "video_effect", aliases: ["video_effect"] },
    { key: "help", aliases: ["help"] },
    { key: "prompts", aliases: ["prompts"] },
  ];

  const chartModules = canonicalModules.map(({ key, aliases }) => ({
    module: key,
    count: data?.activityByModule
      .filter((item) => aliases.includes(item.module))
      .reduce((sum, item) => sum + item.count, 0) ?? 0,
    label: MODULE_META[key]?.label ?? key,
    color: MODULE_META[key]?.color ?? "#666",
  }));`;

if (source.includes(oldChart)) {
  source = source.replace(oldChart, newChart);
}

if (!source.includes('help: { label: "IAttom Help"')) {
  source = source.replace(
    '  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },',
    '  marketing: { label: "Marketing", color: "#FBBF24", icon: Megaphone },\n  help: { label: "IAttom Help", color: "#A1A1AA", icon: Zap },\n  prompts: { label: "Prompt", color: "#22D3EE", icon: Sparkles },',
  );
}

const required = [
  'label: "Validar Produto"',
  'video_effect: { label: "Vídeo com Efeito"',
  'aliases: ["find_products", "product_discovery"]',
  'aliases: ["validate_products", "product_validation"]',
  'aliases: ["video_effect"]',
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Canonical activity module marker missing: ${marker}`);
}

writeFileSync(analyticsUrl, source);
console.log("Activity chart now shows every canonical monitored module, including zero counts.");
