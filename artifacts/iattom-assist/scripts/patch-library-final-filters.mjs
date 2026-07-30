import { readFileSync, writeFileSync } from "node:fs";

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let source = readFileSync(projectsUrl, "utf8");

function replaceOrKeep(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source && !source.includes(typeof replacement === "string" ? replacement : "")) {
    throw new Error(`Library ${label} marker was not found`);
  }
  source = next;
}

// O filtro video_effect é virtual: os registros continuam com o tipo original salvo.
source = source.replace(
  /type TabKey = [^;]+;/,
  'type TabKey = "all" | "campaign" | "content" | "creative" | "video_script" | "video_effect" | "prompt" | "product_discovery" | "product_validation";',
);

source = source.replace(
  /const TABS:[\s\S]*?= \[[\s\S]*?\n\];/,
  `const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all",                label: "Todos",            icon: BookOpen   },
  { key: "campaign",           label: "Campanhas",        icon: Megaphone  },
  { key: "content",            label: "Conteúdos",        icon: FileText   },
  { key: "creative",           label: "Imagens",          icon: Sparkles   },
  { key: "video_script",       label: "Scripts de Vídeo", icon: Video      },
  { key: "video_effect",       label: "Vídeo com Efeito", icon: Video      },
  { key: "prompt",             label: "Prompts",          icon: BookMarked },
  { key: "product_discovery",  label: "Produtos",         icon: Search     },
  { key: "product_validation", label: "Validar Produto",  icon: Search     },
];`,
);

source = source
  .replace('creative:           { label: "Criativo",', 'creative:           { label: "Imagem",')
  .replace('creative:           { label: "Imagem",', 'creative:           { label: "Imagem",')
  .replace('video_script:       { label: "Vídeo",', 'video_script:       { label: "Script de Vídeo",')
  .replace('video_script:       { label: "Script de Vídeo",', 'video_script:       { label: "Script de Vídeo",')
  .replace('product_validation: { label: "Validação",', 'product_validation: { label: "Validar Produto",');

if (!source.includes("const VIDEO_EFFECT_CONFIG")) {
  const configEnd = source.indexOf("\n};", source.indexOf("const TYPE_CONFIG"));
  if (configEnd < 0) throw new Error("Library type config end was not found");
  const insertion = `

const VIDEO_EFFECT_CONFIG = {
  label: "Vídeo com Efeito",
  icon: Video,
  badge: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  cardIcon: "text-fuchsia-400",
};

function isVideoEffectItem(item: SavedItem): boolean {
  if (typeof item.videosData === "string" && item.videosData.trim() && item.videosData !== "[]") return true;
  try {
    const parsed = item.data ? JSON.parse(item.data) as { type?: unknown } : null;
    return parsed?.type === "image-motion-source";
  } catch {
    return false;
  }
}`;
  source = source.slice(0, configEnd + 3) + insertion + source.slice(configEnd + 3);
}

source = source.replace(
  /const filteredItems = savedItems\.filter\(\(item\) => \{[\s\S]*?return matchTab && matchSearch;\n  \}\);/,
  `const filteredItems = savedItems.filter((item) => {
    const videoEffect = isVideoEffectItem(item);
    const matchTab = tab === "all"
      || (tab === "video_effect" && videoEffect)
      || (tab === "creative" && item.type === "creative" && !videoEffect)
      || (!("video_effect" === tab || "creative" === tab) && item.type === tab);
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });`,
);

source = source.replace(
  /const counts = TABS\.reduce<Record<string, number>>\(\(acc, t\) => \{[\s\S]*?return acc;\n  \}, \{\}\);/,
  `const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = t.key === "all"
      ? savedItems.length
      : t.key === "video_effect"
        ? savedItems.filter(isVideoEffectItem).length
        : t.key === "creative"
          ? savedItems.filter((item) => item.type === "creative" && !isVideoEffectItem(item)).length
          : savedItems.filter((item) => item.type === t.key).length;
    return acc;
  }, {});`,
);

// Todos os blocos permanecem visíveis, inclusive quando a contagem é zero.
source = source.replace(/\s*if \(t\.key !== "all" && count === 0\) return null;\s*/g, "\n");

// O card também precisa mostrar a categoria virtual correta.
source = source.replace(
  /const cfg = TYPE_CONFIG\[item\.type\] \?\? \{/,
  'const cfg = isVideoEffectItem(item) ? VIDEO_EFFECT_CONFIG : (TYPE_CONFIG[item.type] ?? {',
);
source = source.replace(
  /icon: BookOpen,\n\s*\};\n\s*const Icon = cfg\.icon;/,
  'icon: BookOpen,\n              });\n              const Icon = cfg.icon;',
);

source = source
  .replace("Campanhas, conteúdos, criativos e scripts gerados e salvos.", "Campanhas, conteúdos, imagens, scripts de vídeo, vídeos com efeito, prompts, produtos e validações salvos.")
  .replace("Campanhas, conteúdos, criativos, scripts e prompts gerados e salvos.", "Campanhas, conteúdos, imagens, scripts de vídeo, vídeos com efeito, prompts, produtos e validações salvos.")
  .replace('Gere e salve campanhas, criativos, conteúdos e scripts.', 'Gere e salve campanhas, imagens, scripts de vídeo, vídeos com efeito, prompts, conteúdos, produtos e validações.');

const required = [
  'label: "Imagens"',
  'label: "Scripts de Vídeo"',
  'label: "Vídeo com Efeito"',
  'label: "Prompts"',
  'label: "Validar Produto"',
  'parsed?.type === "image-motion-source"',
  'savedItems.filter(isVideoEffectItem).length',
  'item.type === t.key',
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Library final marker missing: ${marker}`);
}
if (source.includes('label: "Vídeos"')) throw new Error("Library incorrectly renamed Scripts de Vídeo");

writeFileSync(projectsUrl, source);
console.log("Library preserves all existing filters and adds Prompts without replacing other categories.");