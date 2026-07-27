import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

const resetFunctionEnd = `  const resetCreateForm = () => {\n    setCreating(false);\n    setGuidedTipo("Imagem");\n    setGuidedSubject("");\n    setPendingTipo(null);\n    setNewTitle("");\n    setNewPrompt("");\n    setGenerated(false);\n  };`;

const refreshFunction = `${resetFunctionEnd}\n\n  const refreshPromptModule = async () => {\n    setSearch("");\n    resetCreateForm();\n    await fetchPrompts();\n  };`;

if (!source.includes("const refreshPromptModule = async () =>")) {
  if (!source.includes(resetFunctionEnd)) {
    throw new Error("Criar Prompt resetCreateForm marker not found");
  }
  source = source.replace(resetFunctionEnd, refreshFunction);
}

const listOnlyRefresh = "          onClick={() => void fetchPrompts()}";
const fullModuleRefresh = "          onClick={() => void refreshPromptModule()}";

if (source.includes(listOnlyRefresh)) {
  source = source.replace(listOnlyRefresh, fullModuleRefresh);
} else if (!source.includes(fullModuleRefresh)) {
  throw new Error("Criar Prompt Atualizar button marker not found");
}

if (!source.includes('setSearch("");') || !source.includes("resetCreateForm();") || !source.includes("await fetchPrompts();")) {
  throw new Error("Criar Prompt full module refresh was not installed");
}

fs.writeFileSync(pagePath, source);
console.log("Criar Prompt Atualizar agora limpa o módulo inteiro e recarrega os prompts");
