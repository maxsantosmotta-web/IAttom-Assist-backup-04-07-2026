import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

const listOnlyRefresh = "          onClick={() => void fetchPrompts()}";
const manualModuleRefresh = "          onClick={() => void refreshPromptModule()}";
const browserLikeRefresh = "          onClick={() => window.location.reload()}";

if (source.includes(listOnlyRefresh)) {
  source = source.replace(listOnlyRefresh, browserLikeRefresh);
} else if (source.includes(manualModuleRefresh)) {
  source = source.replace(manualModuleRefresh, browserLikeRefresh);
} else if (!source.includes(browserLikeRefresh)) {
  throw new Error("Criar Prompt Atualizar button marker not found");
}

const refreshFunctionPattern = /\n\n  const refreshPromptModule = async \(\) => \{\n    setSearch\(""\);\n    resetCreateForm\(\);\n    await fetchPrompts\(\);\n  \};/;
source = source.replace(refreshFunctionPattern, "");

if (!source.includes(browserLikeRefresh)) {
  throw new Error("Criar Prompt browser-like refresh was not installed");
}
if (source.includes("const refreshPromptModule = async () =>")) {
  throw new Error("Criar Prompt still contains the old manual refresh helper");
}

fs.writeFileSync(pagePath, source);
console.log("Criar Prompt Atualizar agora recarrega a rota inteira como o navegador");
