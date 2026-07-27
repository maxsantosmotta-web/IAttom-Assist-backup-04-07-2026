import { readFileSync, writeFileSync } from "node:fs";

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let source = readFileSync(trashUrl, "utf8");

const oldToUnified = `function toUnified(p: TrashedItem): UnifiedItem {
  const cfg = PROJECT_CFG[p.type] ?? PROJECT_CFG.campaign;
  return {
    uid: \`proj_\${p.id}\`,
    kind: "project",
    displayName: p.title,
    category: cfg.category,
    deletedAt: p.deletedAt,
    expiresAt: p.expiresAt,
    badge: cfg.badge,
    icon: cfg.icon,
    label: cfg.label,
    rawProject: p,
  };
}`;

const newToUnified = `function toUnified(p: TrashedItem): UnifiedItem {
  let isImageMotionSource = false;
  try {
    const parsed = p.data ? JSON.parse(p.data) as { type?: string } : null;
    isImageMotionSource = parsed?.type === "image-motion-source";
  } catch { /* mantém classificação pelo tipo salvo */ }

  const cfg = isImageMotionSource
    ? { label: "Imagem", icon: Sparkles, badge: "bg-purple-400/10 text-purple-400 border-purple-400/20", category: "creative" as FilterCategory }
    : (PROJECT_CFG[p.type] ?? PROJECT_CFG.campaign);

  return {
    uid: \`proj_\${p.id}\`,
    kind: "project",
    displayName: p.title,
    category: cfg.category,
    deletedAt: p.deletedAt,
    expiresAt: p.expiresAt,
    badge: cfg.badge,
    icon: cfg.icon,
    label: cfg.label,
    rawProject: p,
  };
}`;

if (!source.includes(newToUnified)) {
  if (!source.includes(oldToUnified)) throw new Error("Trash toUnified marker was not found");
  source = source.replace(oldToUnified, newToUnified);
}

source = source.replace(
  'className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-50 whitespace-nowrap"',
  'className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 whitespace-nowrap"',
);
source = source.replace(
  'className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-50 whitespace-nowrap"',
  'className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 whitespace-nowrap"',
);

if (!source.includes('parsed?.type === "image-motion-source"')) throw new Error("Image-motion trash classification was not applied");
if (!source.includes('text-xs text-emerald-400 hover:text-emerald-300')) throw new Error("Restore action active style was not applied");
if (!source.includes('text-xs text-red-400 hover:text-red-300')) throw new Error("Permanent delete action active style was not applied");

writeFileSync(trashUrl, source);
console.log("Image-motion trash items are labeled as Imagem, restore to Biblioteca, and expose active restore/delete actions.");
