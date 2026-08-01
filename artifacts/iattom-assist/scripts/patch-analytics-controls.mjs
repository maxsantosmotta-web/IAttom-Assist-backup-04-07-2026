import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

if (!source.includes('data-iattom-analytics-controls="true"')) {
  const oldBlock = `        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setRefreshTick((value) => value + 1)} disabled={loading} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5">
            <RefreshCw className={\`w-3.5 h-3.5 \${loading ? "animate-spin" : ""}\`} /> Atualizar
          </Button>
        </div>`;

  const newBlock = `        <div data-iattom-analytics-controls="true" className="flex justify-end items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">
            Voltar
          </Button>
        </div>`;

  if (!source.includes(oldBlock)) {
    throw new Error("Analytics controls marker not found");
  }

  source = source.replace(oldBlock, newBlock);
}

for (const marker of [
  'data-iattom-analytics-controls="true"',
  'onClick={() => window.location.reload()}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Analytics marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Atividades controls standardized with full-page refresh and Voltar.");
