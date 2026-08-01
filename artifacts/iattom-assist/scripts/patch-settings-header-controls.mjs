import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/settings": "Configurações",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const settingsUrl = new URL("../src/pages/dashboard/Settings.tsx", import.meta.url);
let source = readFileSync(settingsUrl, "utf8");

if (!source.includes('data-iattom-settings-controls="true"')) {
  const buttonPattern = /([ \t]*)<Button\b(?=[\s\S]*?handleSettingsRefresh\(\))(?=[\s\S]*?Atualizar\s*<\/Button>)[\s\S]*?<\/Button>/;
  const match = source.match(buttonPattern);

  if (!match) {
    throw new Error("Settings refresh control not found");
  }

  const indent = match[1];
  const controls = `${indent}<div data-iattom-settings-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">\n${indent}    <RefreshCw className="w-3.5 h-3.5" />\n${indent}    Atualizar\n${indent}  </Button>\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  source = source.replace(match[0], controls);
}

for (const marker of [
  'data-iattom-settings-controls="true"',
  'onClick={() => window.location.reload()}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Settings marker missing: ${marker}`);
}

writeFileSync(settingsUrl, source, "utf8");
console.log("Settings controls standardized with full-page refresh and Voltar.");
