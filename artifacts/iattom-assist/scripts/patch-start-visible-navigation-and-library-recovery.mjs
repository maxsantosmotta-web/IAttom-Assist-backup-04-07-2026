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

// Configurações, Créditos, Lixeira, Campanha, Atividades e Painel:
// remove o Atualizar antigo e instala Voltar + Atualizar que recarrega a tela.
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

// Faturamento e Biblioteca: somente Voltar.
insertActions("pages/dashboard/Billing.tsx", "Billing", false);
insertActions("pages/dashboard/Projects.tsx", "Projects", false);

// Gerar imagem e Vídeo com efeito compartilham o componente e recebem o mesmo Voltar.
insertActions("pages/dashboard/CreativeGenerator.tsx", "CreativeGenerator", false);

// Criar Prompt já tinha navegação; apenas simplifica o texto.
{
  const { url, source: original } = read("pages/dashboard/SavedPrompts.tsx");
  const source = original
    .replace(/Voltar ao painel/gi, "Voltar")
    .replace(/Voltar para o painel/gi, "Voltar")
    .replace(/Voltar ao Dashboard/gi, "Voltar")
    .replace(/Voltar para o Dashboard/gi, "Voltar");
  write(url, source);
}

// O START pode abrir a Biblioteca logo após um reload, antes do token do Clerk
// ficar pronto. Aumenta a janela de tentativa sem mudar autenticação ou regras.
{
  const { url, source: original } = read("hooks/useSavedItems.ts");
  const source = original.replace(
    "const retryDelays = [0, 300, 700];",
    "const retryDelays = [0, 300, 700, 1200, 2000, 3000];",
  );
  write(url, source);
}

// A Biblioteca global carrega mais projetos em paralelo e repete a listagem uma
// vez se a sessão ainda estiver acordando após a atualização da página.
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

// Remove de forma definitiva os cards públicos de Ajuda ligados a indicação,
// referência ou bônus por convite, sem tocar nas demais orientações.
{
  const { url, source: original } = read("pages/HelpPage.tsx");
  let source = original;
  const cardStart = '<div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">';
  const forbidden = /indica(?:ç|c)|referênc|referenc|bônus de convite|bonus de convite/i;
  let cursor = 0;
  while (true) {
    const start = source.indexOf(cardStart, cursor);
    if (start < 0) break;
    const endToken = "              </div>";
    const end = source.indexOf(endToken, start + cardStart.length);
    if (end < 0) break;
    const card = source.slice(start, end + endToken.length);
    if (forbidden.test(card)) {
      source = source.slice(0, start) + source.slice(end + endToken.length);
      cursor = start;
    } else {
      cursor = end + endToken.length;
    }
  }
  write(url, source);
}

console.log("Navigation, full-page refresh, library recovery and referral-help cleanup applied.");
