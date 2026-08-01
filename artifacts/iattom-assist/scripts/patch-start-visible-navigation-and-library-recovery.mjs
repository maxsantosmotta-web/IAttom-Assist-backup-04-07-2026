import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../src/", import.meta.url);

function read(relativePath) {
  const url = new URL(relativePath, root);
  return { url, source: readFileSync(url, "utf8") };
}

function write(url, source) {
  writeFileSync(url, source, "utf8");
}

const backButton = `<button
          type="button"
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.assign("/dashboard");
          }}
          className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
        >
          ← Voltar
        </button>`;

const refreshButton = `<button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-9 items-center justify-center rounded-md border border-primary/35 bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          Atualizar
        </button>`;

function actionBar(withRefresh) {
  return `\n      {/* Ações simples do módulo */}\n      <div className="flex flex-wrap items-center gap-2">\n        ${backButton}${withRefresh ? `\n        ${refreshButton}` : ""}\n      </div>\n`;
}

function insertActions(relativePath, functionName, withRefresh) {
  const { url, source: original } = read(relativePath);
  if (original.includes("Ações simples do módulo")) return;

  let source = original;
  const fnIndex = source.indexOf(`export function ${functionName}`);
  if (fnIndex < 0) return;
  const returnIndex = source.indexOf("return (", fnIndex);
  if (returnIndex < 0) return;
  const divIndex = source.indexOf("<div", returnIndex);
  if (divIndex < 0) return;
  const closeIndex = source.indexOf(">", divIndex);
  if (closeIndex < 0) return;

  source = source.slice(0, closeIndex + 1) + actionBar(withRefresh) + source.slice(closeIndex + 1);
  write(url, source);
}

function removeFirstUpdateButton(relativePath, functionName) {
  const { url, source: original } = read(relativePath);
  let source = original;
  const fnIndex = source.indexOf(`export function ${functionName}`);
  if (fnIndex < 0) return;
  const updateIndex = source.indexOf("Atualizar", fnIndex);
  if (updateIndex < 0) return;

  const buttonStart = Math.max(source.lastIndexOf("<Button", updateIndex), source.lastIndexOf("<button", updateIndex));
  if (buttonStart < 0) return;
  const isComponent = source.startsWith("<Button", buttonStart);
  const endToken = isComponent ? "</Button>" : "</button>";
  const buttonEnd = source.indexOf(endToken, updateIndex);
  if (buttonEnd < 0) return;

  source = source.slice(0, buttonStart) + source.slice(buttonEnd + endToken.length);
  write(url, source);
}

for (const [path, name] of [
  ["pages/dashboard/Settings.tsx", "Settings"],
  ["pages/dashboard/Credits.tsx", "Credits"],
  ["pages/dashboard/Trash.tsx", "Trash"],
  ["pages/dashboard/CreateCampaign.tsx", "CreateCampaign"],
  ["pages/dashboard/History.tsx", "History"],
  ["pages/dashboard/DashboardHome.tsx", "DashboardHome"],
]) {
  removeFirstUpdateButton(path, name);
  insertActions(path, name, true);
}

insertActions("pages/dashboard/Billing.tsx", "Billing", false);
insertActions("pages/dashboard/Projects.tsx", "Projects", false);
insertActions("pages/dashboard/CreativeGenerator.tsx", "CreativeGenerator", false);

{
  const { url, source: original } = read("pages/dashboard/SavedPrompts.tsx");
  const source = original
    .replace(/Voltar ao painel/gi, "Voltar")
    .replace(/Voltar para o painel/gi, "Voltar")
    .replace(/Voltar ao Dashboard/gi, "Voltar")
    .replace(/Voltar para o Dashboard/gi, "Voltar");
  write(url, source);
}

{
  const { url, source: original } = read("hooks/useSavedItems.ts");
  const source = original.replace(
    "const retryDelays = [0, 300, 700];",
    "const retryDelays = [0, 300, 700, 1200, 2000, 3000];",
  );
  write(url, source);
}

{
  const { url, source: original } = read("lib/savedImageLibrary.ts");
  let source = original.replace("const CONCURRENCY = 3;", "const CONCURRENCY = 8;");
  source = source.replace(
    "    const items = (await getItems())\n      .filter((item) => !item.deletedAt)",
    `    let rawItems: SavedItemRecord[];\n    try {\n      rawItems = await getItems();\n    } catch {\n      await new Promise((resolve) => setTimeout(resolve, 900));\n      rawItems = await getItems();\n    }\n\n    const items = rawItems\n      .filter((item) => !item.deletedAt)`,
  );
  write(url, source);
}

function addLibraryPrefetch(relativePath, hookLine) {
  const { url, source: original } = read(relativePath);
  if (original.includes("Pré-carrega a Biblioteca global")) return;
  const index = original.indexOf(hookLine);
  if (index < 0) return;
  const insertAt = index + hookLine.length;
  const effect = `\n\n  // Pré-carrega a Biblioteca global para ela já estar pronta ao tocar no botão.\n  useEffect(() => {\n    const timer = window.setTimeout(() => {\n      void loadSavedImageLibrary(getItems, getItemAssets, false)\n        .then((loaded) => { if (mountedRef.current) setAssets(loaded); })\n        .catch(() => {});\n    }, 250);\n    return () => window.clearTimeout(timer);\n  }, [getItems, getItemAssets]);`;
  const source = original.slice(0, insertAt) + effect + original.slice(insertAt);
  write(url, source);
}

addLibraryPrefetch(
  "components/creative/ImageMotionSourcePicker.tsx",
  "  const { getItems, getItemAssets } = useSavedItems();",
);
addLibraryPrefetch(
  "components/prompts/PromptImageReferencePicker.tsx",
  "  const { getItems, getItemAssets } = useSavedItems();",
);

console.log("Navigation, full-page refresh and library recovery applied after all previous patches.");
