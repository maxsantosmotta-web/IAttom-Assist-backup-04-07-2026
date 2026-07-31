import { readFileSync, writeFileSync } from "node:fs";

const promptsUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let prompts = readFileSync(promptsUrl, "utf8");

if (!prompts.includes('useLocation')) {
  const reactMarker = 'import { useEffect, useRef, useState } from "react";';
  if (!prompts.includes(reactMarker)) throw new Error("SavedPrompts React import marker not found");
  prompts = prompts.replace(reactMarker, `${reactMarker}\nimport { useLocation } from "wouter";`);
}

const iconImport = 'import { Copy, Plus, Save, Wand2 } from "lucide-react";';
if (prompts.includes(iconImport)) {
  prompts = prompts.replace(iconImport, 'import { ArrowLeft, Copy, Plus, RefreshCw, Save, Wand2 } from "lucide-react";');
}

const accessMarker = '  const { planSlug, isAdmin } = useUserAccess();';
if (!prompts.includes('const [, setLocation] = useLocation();')) {
  if (!prompts.includes(accessMarker)) throw new Error("SavedPrompts access marker not found");
  prompts = prompts.replace(accessMarker, `${accessMarker}\n  const [, setLocation] = useLocation();`);
}

const oldHeader = `      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}>
        <div className="space-y-1">
          <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
          <h2 className="text-2xl font-black tracking-tight text-white">Criar Prompt</h2>
          <p className="text-sm text-zinc-500">Crie, salve e reutilize seus prompts.</p>
        </div>
      </motion.div>`;

const newHeader = `      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Biblioteca</p>
            <h2 className="text-2xl font-black tracking-tight text-white">Criar Prompt</h2>
            <p className="text-sm text-zinc-500">Crie, salve e reutilize seus prompts.</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-start">
            <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/dashboard")} className="h-9 border-white/10 text-xs">
              <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Voltar ao Painel
            </Button>
          </div>
        </div>
      </motion.div>`;

if (!prompts.includes('Voltar ao Painel')) {
  if (!prompts.includes(oldHeader)) throw new Error("SavedPrompts header marker not found");
  prompts = prompts.replace(oldHeader, newHeader);
}

for (const marker of ['window.location.reload()', 'setLocation("/dashboard")', 'Voltar ao Painel', '> Atualizar']) {
  if (!prompts.includes(marker)) throw new Error(`SavedPrompts navigation marker missing: ${marker}`);
}
writeFileSync(promptsUrl, prompts, "utf8");

const mainUrl = new URL("../src/main.tsx", import.meta.url);
let main = readFileSync(mainUrl, "utf8");
const recoveryMarker = 'const CHUNK_RECOVERY_KEY = "iattom_chunk_recovery_v1";';
if (!main.includes(recoveryMarker)) {
  const insertAfter = 'import { initializeAdminManualDeleteEnhancer } from "./lib/adminManualDeleteEnhancer";';
  if (!main.includes(insertAfter)) throw new Error("main.tsx import marker not found");
  const recoveryBlock = `${insertAfter}\n\nconst CHUNK_RECOVERY_KEY = "iattom_chunk_recovery_v1";\n\nfunction recoverFromChunkFailure(error: unknown): void {\n  const message = error instanceof Error ? error.message : String(error ?? "");\n  if (!/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message)) return;\n\n  const now = Date.now();\n  const lastAttempt = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? "0");\n  if (now - lastAttempt < 60_000) return;\n\n  sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));\n  window.location.reload();\n}\n\nwindow.addEventListener("vite:preloadError", (event) => {\n  event.preventDefault();\n  sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));\n  window.location.reload();\n});\n\nwindow.addEventListener("unhandledrejection", (event) => {\n  recoverFromChunkFailure(event.reason);\n});\n\nwindow.addEventListener("error", (event) => {\n  recoverFromChunkFailure(event.error ?? event.message);\n});`;
  main = main.replace(insertAfter, recoveryBlock);
}

for (const marker of [recoveryMarker, 'vite:preloadError', 'Failed to fetch dynamically imported module', 'window.location.reload()']) {
  if (!main.includes(marker)) throw new Error(`Global chunk recovery marker missing: ${marker}`);
}
writeFileSync(mainUrl, main, "utf8");

console.log("Criar Prompt navigation restored and global lazy-chunk recovery installed.");