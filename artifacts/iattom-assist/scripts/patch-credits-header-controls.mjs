import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/credits": "Créditos",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");

if (!source.includes('data-iattom-credits-controls="true"')) {
  const refreshButtonPattern = /([ \t]*)<Button\b(?=[\s\S]*?refetchBalance\(\))(?=[\s\S]*?refetchTx\(\))(?=[\s\S]*?Atualizar)[\s\S]*?<\/Button>/;
  const match = source.match(refreshButtonPattern);

  if (!match) {
    throw new Error("Credits functional refresh button not found");
  }

  const indent = match[1];
  const newControls = `${indent}<div data-iattom-credits-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">\n${indent}    <RefreshCw className="w-3.5 h-3.5" />\n${indent}    Atualizar\n${indent}  </Button>\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  source = source.replace(match[0], newControls);
}

for (const marker of [
  'data-iattom-credits-controls="true"',
  'onClick={() => window.location.reload()}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Credits marker missing: ${marker}`);
}

if (source.includes('onClick={() => { void refetchBalance(); void refetchTx(); }}')) {
  throw new Error("Legacy Credits partial refresh is still present");
}

writeFileSync(creditsUrl, source, "utf8");
console.log("Credits controls standardized with full-page refresh and Voltar.");

await import("./patch-settings-header-controls.mjs");
