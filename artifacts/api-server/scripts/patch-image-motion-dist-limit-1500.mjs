import { readFileSync, writeFileSync } from "node:fs";

const distUrl = new URL("../dist/index.mjs", import.meta.url);
let dist = readFileSync(distUrl, "utf8");
const before = dist;

// Garante o limite no artefato realmente executado pelo Railway, depois do bundle.
dist = dist
  .replaceAll("MAX_PROMPT_LENGTH = 1200", "MAX_PROMPT_LENGTH = 1500")
  .replaceAll("MAX_PROMPT_LENGTH=1200", "MAX_PROMPT_LENGTH=1500")
  .replaceAll("no máximo 1200 caracteres", "no máximo 1500 caracteres")
  .replaceAll("no máximo 1.200 caracteres", "no máximo 1.500 caracteres");

if (dist === before && !dist.includes("MAX_PROMPT_LENGTH = 1500") && !dist.includes("MAX_PROMPT_LENGTH=1500")) {
  throw new Error("Compiled image-motion limit marker was not found in dist/index.mjs");
}

if (
  dist.includes("MAX_PROMPT_LENGTH = 1200") ||
  dist.includes("MAX_PROMPT_LENGTH=1200") ||
  dist.includes("no máximo 1200 caracteres") ||
  dist.includes("no máximo 1.200 caracteres")
) {
  throw new Error("Compiled API still contains the obsolete 1,200-character image-motion limit");
}

writeFileSync(distUrl, dist, "utf8");
console.log("Compiled Railway API artifact now enforces the 1,500-character image-motion limit.");
