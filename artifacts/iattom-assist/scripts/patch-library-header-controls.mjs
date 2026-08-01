import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/projects": "Biblioteca",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
let source = readFileSync(projectsUrl, "utf8");

if (!source.includes('data-iattom-library-controls="true"')) {
  const refreshButtonPattern = /([ \t]*)<Button\b(?=[\s\S]*?window\.location\.reload\(\))(?=[\s\S]*?isRefreshing)(?=[\s\S]*?Atualizar)[\s\S]*?<\/Button>/;
  const match = source.match(refreshButtonPattern);

  if (!match) {
    throw new Error("Library refresh button not found");
  }

  const indent = match[1];
  const controls = `${indent}<div data-iattom-library-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} disabled={isRefreshing} className="h-9 border-white/10 text-xs gap-1.5">\n${indent}    <RefreshCw className={\`w-3.5 h-3.5 \${isRefreshing ? "animate-spin" : ""}\`} />\n${indent}    Atualizar\n${indent}  </Button>\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  source = source.replace(match[0], controls);
}

for (const marker of [
  'data-iattom-library-controls="true"',
  'onClick={() => window.location.reload()}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Library marker missing: ${marker}`);
}

writeFileSync(projectsUrl, source, "utf8");
console.log("Library controls standardized without changing their functions.");
