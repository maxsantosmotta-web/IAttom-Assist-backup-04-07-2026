import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../src/pages/dashboard/", import.meta.url);

function replaceExactOrAlready(relativePath, before, after, label) {
  const fileUrl = new URL(relativePath, root);
  const source = readFileSync(fileUrl, "utf8");
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`${label}: marcador não encontrado`);
  }
  writeFileSync(fileUrl, source.replace(before, after), "utf8");
}

replaceExactOrAlready(
  "History.tsx",
  "onClick={() => void refetch()}",
  "onClick={() => window.location.reload()}",
  "Atividades Atualizar",
);

replaceExactOrAlready(
  "Credits.tsx",
  "onClick={() => { void refetchBalance(); void refetchTx(); }}",
  "onClick={() => window.location.reload()}",
  "Créditos Atualizar",
);

replaceExactOrAlready(
  "Settings.tsx",
  "onClick={() => void handleSettingsRefresh()}",
  "onClick={() => window.location.reload()}",
  "Configurações Atualizar",
);

{
  const fileUrl = new URL("CreateCampaign.tsx", root);
  let source = readFileSync(fileUrl, "utf8");

  const visibleCorrect = "        {(\n          <Button size=\"sm\" variant=\"outline\" onClick={() => window.location.reload()}";
  if (!source.includes(visibleCorrect)) {
    const visibilityMarker = "        {showResult && (\n          <Button size=\"sm\" variant=\"outline\"";
    if (!source.includes(visibilityMarker)) {
      throw new Error("Criar Campanha: marcador de visibilidade não encontrado");
    }
    source = source.replace(
      visibilityMarker,
      "        {(\n          <Button size=\"sm\" variant=\"outline\"",
    );

    const handlerPattern = /onClick=\{\(\) => \{ setIsRefreshing\(true\); void refetchCredits\(\); setTimeout\(\(\) => \{ try \{ if \(currentPlatform\) \{ const p = loadModuleState<[\s\S]*?setIsRefreshing\(false\); \}, 750\); \}\}/;
    const matches = source.match(handlerPattern);
    if (!matches || matches.length !== 1) {
      throw new Error("Criar Campanha: manipulador Atualizar não encontrado com segurança");
    }
    source = source.replace(handlerPattern, "onClick={() => window.location.reload()}");
    writeFileSync(fileUrl, source, "utf8");
  }
}

console.log("Funções de Atualizar corrigidas somente em Atividades, Créditos, Configurações e Criar Campanha.");
