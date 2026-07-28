import { readFileSync, writeFileSync } from "node:fs";

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let source = readFileSync(projectsUrl, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Library ${label} marker was not found`);
  source = source.replace(before, after);
}

replaceRequired(
  'type TabKey = "all" | "campaign" | "content" | "creative" | "video_script" | "product_discovery";',
  'type TabKey = "all" | "campaign" | "content" | "creative" | "video_script" | "product_discovery" | "product_validation";',
  "tab type",
);

replaceRequired(
  `  { key: "creative",          label: "Criativos",       icon: Sparkles   },\n  { key: "video_script",      label: "Scripts de Vídeo", icon: Video      },\n  { key: "product_discovery", label: "Produtos",        icon: Search     },`,
  `  { key: "creative",          label: "Imagens",          icon: Sparkles   },\n  { key: "video_script",      label: "Vídeos",           icon: Video      },\n  { key: "product_discovery", label: "Produtos",         icon: Search     },\n  { key: "product_validation", label: "Validar Produto", icon: Search     },`,
  "tabs",
);

replaceRequired(
  '  creative:           { label: "Criativo",         icon: Sparkles,',
  '  creative:           { label: "Imagem",           icon: Sparkles,',
  "image label",
);

replaceRequired(
  '  video_script:       { label: "Script de Vídeo",  icon: Video,',
  '  video_script:       { label: "Vídeo",            icon: Video,',
  "video label",
);

replaceRequired(
  '  product_validation: { label: "Validação",        icon: Search,',
  '  product_validation: { label: "Validar Produto",  icon: Search,',
  "validation label",
);

replaceRequired(
  "              Campanhas, conteúdos, criativos e scripts gerados e salvos.",
  "              Campanhas, conteúdos, imagens, vídeos, produtos e validações salvos.",
  "header copy",
);

replaceRequired(
  '          if (t.key !== "all" && count === 0) return null;\n',
  "",
  "zero-count visibility",
);

replaceRequired(
  ': "Gere e salve campanhas, criativos, conteúdos e scripts."}',
  ': "Gere e salve campanhas, imagens, vídeos, conteúdos, produtos e validações."}',
  "empty-state copy",
);

if (!source.includes('label: "Imagens"') || !source.includes('label: "Vídeos"') || !source.includes('label: "Validar Produto"')) {
  throw new Error("Library final filters were not installed");
}
if (source.includes('if (t.key !== "all" && count === 0) return null;')) {
  throw new Error("Library still hides empty filters");
}

writeFileSync(projectsUrl, source);
console.log("Active Library now shows Imagens, Vídeos and Validar Produto filters.");
