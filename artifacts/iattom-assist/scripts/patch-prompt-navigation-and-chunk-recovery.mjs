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
  prompts = prompts.replace(iconImport, 'import { Copy, Plus, RefreshCw, Save, Wand2 } from "lucide-react";');
}
if (prompts.includes('import { ArrowLeft, Copy, Plus, RefreshCw, Save, Wand2 } from "lucide-react";')) {
  prompts = prompts.replace(
    'import { ArrowLeft, Copy, Plus, RefreshCw, Save, Wand2 } from "lucide-react";',
    'import { Copy, Plus, RefreshCw, Save, Wand2 } from "lucide-react";',
  );
}

const accessMarker = '  const { planSlug, isAdmin } = useUserAccess();';
if (!prompts.includes('const [, setLocation] = useLocation();')) {
  if (!prompts.includes(accessMarker)) throw new Error("SavedPrompts access marker not found");
  prompts = prompts.replace(accessMarker, `${accessMarker}\n  const [, setLocation] = useLocation();`);
}

const draftConstantMarker = 'const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };';
if (!prompts.includes('const PROMPT_DRAFT_KEY = "iattom_create_prompt_draft_v1";')) {
  if (!prompts.includes(draftConstantMarker)) throw new Error("SavedPrompts fade marker not found");
  prompts = prompts.replace(
    draftConstantMarker,
    `${draftConstantMarker}\nconst PROMPT_DRAFT_KEY = "iattom_create_prompt_draft_v1";`,
  );
}

const subjectRefMarker = '  const subjectInputRef = useRef<HTMLTextAreaElement | null>(null);';
const persistenceBlock = `  const subjectInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROMPT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          tipo?: string;
          subject?: string;
          title?: string;
          prompt?: string;
          generated?: boolean;
        };
        setGuidedTipo(typeof draft.tipo === "string" ? draft.tipo : "");
        setGuidedSubject(typeof draft.subject === "string" ? draft.subject : "");
        setNewTitle(typeof draft.title === "string" ? draft.title : "");
        setNewPrompt(typeof draft.prompt === "string" ? draft.prompt : "");
        setGenerated(Boolean(draft.generated && draft.title && draft.prompt));
      }
    } catch {
      localStorage.removeItem(PROMPT_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const hasDraft = Boolean(
      guidedTipo || guidedSubject.trim() || newTitle.trim() || newPrompt.trim(),
    );
    if (!hasDraft) {
      localStorage.removeItem(PROMPT_DRAFT_KEY);
      return;
    }
    localStorage.setItem(PROMPT_DRAFT_KEY, JSON.stringify({
      tipo: guidedTipo,
      subject: guidedSubject,
      title: newTitle,
      prompt: newPrompt,
      generated,
      updatedAt: new Date().toISOString(),
    }));
  }, [draftReady, guidedTipo, guidedSubject, newTitle, newPrompt, generated]);`;

if (!prompts.includes('const [draftReady, setDraftReady] = useState(false);')) {
  if (!prompts.includes(subjectRefMarker)) throw new Error("SavedPrompts subject ref marker not found");
  prompts = prompts.replace(subjectRefMarker, persistenceBlock);
}

const clearMarker = `  const clearForm = () => {
    setGuidedTipo("");`;
const clearBlock = `  const clearForm = () => {
    localStorage.removeItem(PROMPT_DRAFT_KEY);
    setGuidedTipo("");`;
if (!prompts.includes('const clearForm = () => {\n    localStorage.removeItem(PROMPT_DRAFT_KEY);')) {
  if (!prompts.includes(clearMarker)) throw new Error("SavedPrompts clear marker not found");
  prompts = prompts.replace(clearMarker, clearBlock);
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
              Voltar
            </Button>
          </div>
        </div>
      </motion.div>`;

const legacyHeader = `      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }}>
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

if (prompts.includes(legacyHeader)) {
  prompts = prompts.replace(legacyHeader, newHeader);
} else if (!prompts.includes('>\n              Voltar\n            </Button>')) {
  if (!prompts.includes(oldHeader)) throw new Error("SavedPrompts header marker not found");
  prompts = prompts.replace(oldHeader, newHeader);
}

for (const marker of [
  'window.location.reload()',
  'setLocation("/dashboard")',
  '>\n              Voltar\n            </Button>',
  '> Atualizar',
  'const PROMPT_DRAFT_KEY = "iattom_create_prompt_draft_v1";',
  'const [draftReady, setDraftReady] = useState(false);',
  'localStorage.setItem(PROMPT_DRAFT_KEY',
  'localStorage.removeItem(PROMPT_DRAFT_KEY);',
]) {
  if (!prompts.includes(marker)) throw new Error(`SavedPrompts marker missing: ${marker}`);
}
if (prompts.includes('Voltar ao Painel') || prompts.includes('<ArrowLeft')) {
  throw new Error("SavedPrompts ainda contém seta ou texto Painel no botão Voltar");
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

await import("./patch-prompt-video-reference-persistence.mjs");

console.log("Criar Prompt now preserves its current result and the Vídeo com Imagem reference across module changes and reloads, while keeping the approved navigation and chunk recovery.");
