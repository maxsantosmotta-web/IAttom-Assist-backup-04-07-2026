import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

source = source.replace(
  "const canOpenImageMotion = isAdmin || (videoBalance ?? 0) > 0;",
  "const canOpenImageMotion = true;",
);

if (!source.includes("const canOpenImageMotion = true;")) {
  throw new Error("Final video module unlock was not applied");
}

writeFileSync(creativeUrl, source);
console.log("Vídeo com Imagem module unlocked for commercial testing.");