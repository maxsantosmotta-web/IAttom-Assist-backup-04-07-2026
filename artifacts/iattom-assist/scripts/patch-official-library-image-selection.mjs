import { readFileSync, writeFileSync } from "node:fs";

const projectsUrl = new URL("../src/pages/dashboard/Projects.tsx", import.meta.url);
const promptPickerUrl = new URL("../src/components/prompts/PromptImageReferencePicker.tsx", import.meta.url);
const motionPickerUrl = new URL("../src/components/creative/ImageMotionSourcePicker.tsx", import.meta.url);
const promptsUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);

let projects = readFileSync(projectsUrl, "utf8");
let promptPicker = readFileSync(promptPickerUrl, "utf8");
let motionPicker = readFileSync(motionPickerUrl, "utf8");
let prompts = readFileSync(promptsUrl, "utf8");

const REQUEST_KEY = "iattom_official_library_selection_request_v1";
const RESULT_KEY = "iattom_official_library_selection_result_v1";

// Biblioteca oficial: ativa um modo de seleção sem alterar o uso normal pelo menu.
projects = projects.replace(
  'const { getItems, trashItem, saveItem } = useSavedItems();',
  'const { getItems, getItemAssets, trashItem, saveItem } = useSavedItems();',
);

projects = projects.replace(
  '  const [tab, setTab]               = useState<TabKey>("all");',
  `  const selectionTarget = new URLSearchParams(window.location.search).get("selectImage");
  const isImageSelectionMode = selectionTarget === "prompt" || selectionTarget === "motion";
  const [tab, setTab]               = useState<TabKey>(isImageSelectionMode ? "creative" : "all");`,
);

projects = projects.replace(
  '  const [isRefreshing, setIsRefreshing] = useState(false);',
  `  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectingImageId, setSelectingImageId] = useState<string | null>(null);`,
);

projects = projects.replace(
  '  const handleOpenItem = (item: SavedItem) => navigate(`/dashboard/projects/${item.id}`);',
  `  const handleOpenItem = async (item: SavedItem) => {
    if (!isImageSelectionMode) {
      navigate(\`/dashboard/projects/\${item.id}\`);
      return;
    }

    if (!item.hasImages || selectingImageId) return;
    setSelectingImageId(item.id);
    try {
      const assets = await getItemAssets(item.id);
      const asset = assets.find((entry) => Boolean(entry.base64?.trim()));
      if (!asset) throw new Error("Imagem sem arquivo disponível");

      let request: { target?: string; returnTo?: string } = {};
      try {
        request = JSON.parse(sessionStorage.getItem("${REQUEST_KEY}") || "{}") as typeof request;
      } catch { /* usa retorno padrão */ }

      const target = selectionTarget === "motion" ? "motion" : "prompt";
      sessionStorage.setItem("${RESULT_KEY}", JSON.stringify({
        target,
        base64: asset.base64,
        mimeType: /\\.jpe?g$/i.test(asset.label) ? "image/jpeg" : "image/png",
        name: asset.label || item.title,
        origin: "library",
      }));
      sessionStorage.removeItem("${REQUEST_KEY}");
      navigate(request.returnTo || (target === "motion" ? "/dashboard/creative-generator" : "/dashboard/prompts"));
    } catch {
      toast({ description: "Não foi possível selecionar esta imagem.", variant: "destructive" });
    } finally {
      setSelectingImageId(null);
    }
  };`,
);

projects = projects.replace(
  '<h2 className="text-2xl font-bold text-white mb-1">Biblioteca</h2>',
  '<h2 className="text-2xl font-bold text-white mb-1">{isImageSelectionMode ? "Selecionar imagem" : "Biblioteca"}</h2>',
);

projects = projects.replace(
  '              Campanhas, conteúdos, imagens, scripts de vídeo, vídeos com efeito, prompts, produtos e validações salvos.',
  '              {isImageSelectionMode ? "Escolha uma imagem salva no bloco Imagens." : "Campanhas, conteúdos, imagens, scripts de vídeo, vídeos com efeito, prompts, produtos e validações salvos."}',
);

projects = projects.replace(
  '          <Button\n            size="sm"',
  `          {isImageSelectionMode && (
            <Button size="sm" variant="outline" onClick={() => navigate(selectionTarget === "motion" ? "/dashboard/creative-generator" : "/dashboard/prompts")} className="border-white/10 text-zinc-400 hover:text-white">
              Voltar
            </Button>
          )}
          <Button
            size="sm"`,
);

projects = projects.replace(
  '{TABS.map((t) => {',
  '{(isImageSelectionMode ? TABS.filter((t) => t.key === "creative") : TABS).map((t) => {',
);

projects = projects.replace(
  '<button\n                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }}',
  '{!isImageSelectionMode && <button\n                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }}',
);
projects = projects.replace(
  '                          <Trash2 className="w-3.5 h-3.5" />\n                        </button>',
  '                          <Trash2 className="w-3.5 h-3.5" />\n                        </button>}',
);
projects = projects.replace(
  '<span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Abrir <ExternalLink className="w-3 h-3" /></span>',
  '<span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{isImageSelectionMode ? (selectingImageId === item.id ? "Selecionando..." : "Selecionar") : "Abrir"} <ExternalLink className="w-3 h-3" /></span>',
);

// O Criar Prompt deixa de abrir o modal paralelo e navega para a Biblioteca oficial.
promptPicker = promptPicker.replace(
  'import { useEffect, useRef, useState } from "react";',
  'import { useEffect, useRef, useState } from "react";\nimport { useLocation } from "wouter";',
);
promptPicker = promptPicker.replace(
  '  const fileRef = useRef<HTMLInputElement>(null);',
  '  const fileRef = useRef<HTMLInputElement>(null);\n  const [, navigate] = useLocation();',
);
promptPicker = promptPicker.replace(
  '  const selectSource = (next: PromptImageReference) => {',
  `  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("${RESULT_KEY}");
      if (!raw) return;
      const selected = JSON.parse(raw) as PromptImageReference & { target?: string };
      if (selected.target !== "prompt" || !selected.base64) return;
      sessionStorage.removeItem("${RESULT_KEY}");
      onChange({ base64: selected.base64, mimeType: selected.mimeType, name: selected.name, origin: "library" });
    } catch { /* seleção inválida permanece ignorada */ }
  }, [onChange]);

  const openOfficialLibrary = () => {
    sessionStorage.setItem("${REQUEST_KEY}", JSON.stringify({ target: "prompt", returnTo: "/dashboard/prompts" }));
    navigate("/dashboard/projects?selectImage=prompt");
  };

  const selectSource = (next: PromptImageReference) => {`,
);
promptPicker = promptPicker.replaceAll('onClick={() => void openLibrary()}', 'onClick={openOfficialLibrary}');

// O Gerador de Vídeo com Efeito usa a mesma Biblioteca oficial.
motionPicker = motionPicker.replace(
  'import { useEffect, useRef, useState } from "react";',
  'import { useEffect, useRef, useState } from "react";\nimport { useLocation } from "wouter";',
);
motionPicker = motionPicker.replace(
  '  const fileRef = useRef<HTMLInputElement>(null);',
  '  const fileRef = useRef<HTMLInputElement>(null);\n  const [, navigate] = useLocation();',
);
motionPicker = motionPicker.replace(
  '  const persist = async (next: ImageMotionSource) => {',
  `  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("${RESULT_KEY}");
      if (!raw) return;
      const selected = JSON.parse(raw) as ImageMotionSource & { target?: string };
      if (selected.target !== "motion" || !selected.base64) return;
      sessionStorage.removeItem("${RESULT_KEY}");
      const next: ImageMotionSource = { base64: selected.base64, mimeType: selected.mimeType, name: selected.name, origin: "library" };
      onChange(next);
      void persist(next).catch(() => setError("A imagem foi escolhida, mas não foi possível preservar o rascunho."));
    } catch { /* seleção inválida permanece ignorada */ }
  }, [onChange]);

  const openOfficialLibrary = () => {
    sessionStorage.setItem("${REQUEST_KEY}", JSON.stringify({ target: "motion", returnTo: "/dashboard/creative-generator" }));
    navigate("/dashboard/projects?selectImage=motion");
  };

  const persist = async (next: ImageMotionSource) => {`,
);
motionPicker = motionPicker.replaceAll('onClick={() => void openLibrary()}', 'onClick={openOfficialLibrary}');

// Ao retornar, o Criar Prompt reabre automaticamente o tipo correto para montar o seletor e consumir o resultado.
const promptStateMarker = '  const [guidedSubject, setGuidedSubject] = useState("");';
if (prompts.includes(promptStateMarker) && !prompts.includes('iattom_official_library_selection_result_v1')) {
  prompts = prompts.replace(
    promptStateMarker,
    `${promptStateMarker}

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("${RESULT_KEY}");
      if (!raw) return;
      const selected = JSON.parse(raw) as { target?: string };
      if (selected.target === "prompt") {
        setGuidedTipo("Vídeo com Imagem");
        setPendingTipo("Vídeo com Imagem");
      }
    } catch { /* seleção inválida permanece ignorada */ }
  }, []);`,
  );
}

for (const [name, source, markers] of [
  ["Projects", projects, ["isImageSelectionMode", "getItemAssets(item.id)", "Selecionar imagem", RESULT_KEY]],
  ["Prompt picker", promptPicker, ["openOfficialLibrary", "selectImage=prompt", RESULT_KEY]],
  ["Motion picker", motionPicker, ["openOfficialLibrary", "selectImage=motion", RESULT_KEY]],
  ["Saved prompts", prompts, [RESULT_KEY, 'setGuidedTipo("Vídeo com Imagem")']],
]) {
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${name} official Library marker missing: ${marker}`);
  }
}

writeFileSync(projectsUrl, projects, "utf8");
writeFileSync(promptPickerUrl, promptPicker, "utf8");
writeFileSync(motionPickerUrl, motionPicker, "utf8");
writeFileSync(promptsUrl, prompts, "utf8");
console.log("Prompt and image-motion selection now use the official Library Images screen without parallel image loading.");
