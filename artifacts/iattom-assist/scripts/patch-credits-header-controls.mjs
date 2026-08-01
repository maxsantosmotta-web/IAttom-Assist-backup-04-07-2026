import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/credits": "Créditos",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");

if (!source.includes('data-iattom-credits-controls="true"')) {
  const oldButton = `          <Button size="sm" variant="outline" onClick={() => { void refetchBalance(); void refetchTx(); }} disabled={fetchingBalance || fetchingTx} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">
            <RefreshCw className={\`w-3.5 h-3.5 \${(fetchingBalance || fetchingTx) ? "animate-spin" : ""}\`} />
            Atualizar
          </Button>`;

  const newControls = `          <div data-iattom-credits-controls="true" className="flex items-center gap-2 shrink-0 mt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">
              Voltar
            </Button>
          </div>`;

  if (!source.includes(oldButton)) {
    throw new Error("Credits header refresh marker not found");
  }

  source = source.replace(oldButton, newControls);
}

for (const marker of [
  'data-iattom-credits-controls="true"',
  'onClick={() => window.location.reload()}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Credits marker missing: ${marker}`);
}

writeFileSync(creditsUrl, source, "utf8");
console.log("Credits controls standardized with full-page refresh and Voltar.");
