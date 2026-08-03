import { readFileSync, writeFileSync } from "node:fs";

const distUrl = new URL("../dist/index.mjs", import.meta.url);
let dist = readFileSync(distUrl, "utf8");

dist = dist
  .replaceAll("MAX_PROMPT_LENGTH = 1200", "MAX_PROMPT_LENGTH = 2000")
  .replaceAll("MAX_PROMPT_LENGTH=1200", "MAX_PROMPT_LENGTH=2000")
  .replaceAll("MAX_PROMPT_LENGTH = 1500", "MAX_PROMPT_LENGTH = 2000")
  .replaceAll("MAX_PROMPT_LENGTH=1500", "MAX_PROMPT_LENGTH=2000")
  .replaceAll("no máximo 1200 caracteres", "no máximo 2000 caracteres")
  .replaceAll("no máximo 1.200 caracteres", "no máximo 2.000 caracteres")
  .replaceAll("no máximo 1500 caracteres", "no máximo 2000 caracteres")
  .replaceAll("no máximo 1.500 caracteres", "no máximo 2.000 caracteres");

if (
  dist.includes("MAX_PROMPT_LENGTH = 1200") ||
  dist.includes("MAX_PROMPT_LENGTH=1200") ||
  dist.includes("MAX_PROMPT_LENGTH = 1500") ||
  dist.includes("MAX_PROMPT_LENGTH=1500") ||
  dist.includes("no máximo 1200 caracteres") ||
  dist.includes("no máximo 1.200 caracteres") ||
  dist.includes("no máximo 1500 caracteres") ||
  dist.includes("no máximo 1.500 caracteres")
) {
  throw new Error("Compiled API still contains an obsolete image-motion prompt limit");
}

writeFileSync(distUrl, dist, "utf8");
console.log("Compiled Railway API artifact contains no obsolete image-motion prompt limit.");
