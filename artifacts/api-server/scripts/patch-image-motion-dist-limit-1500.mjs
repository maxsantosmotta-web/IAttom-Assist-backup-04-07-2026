import { readFileSync, writeFileSync } from "node:fs";

const distUrl = new URL("../dist/index.mjs", import.meta.url);
let dist = readFileSync(distUrl, "utf8");
const before = dist;

dist = dist
  .replaceAll("MAX_PROMPT_LENGTH = 1200", "MAX_PROMPT_LENGTH = 2000")
  .replaceAll("MAX_PROMPT_LENGTH=1200", "MAX_PROMPT_LENGTH=2000")
  .replaceAll("MAX_PROMPT_LENGTH = 1500", "MAX_PROMPT_LENGTH = 2000")
  .replaceAll("MAX_PROMPT_LENGTH=1500", "MAX_PROMPT_LENGTH=2000")
  .replaceAll("no máximo 1200 caracteres", "no máximo 2000 caracteres")
  .replaceAll("no máximo 1.200 caracteres", "no máximo 2.000 caracteres")
  .replaceAll("no máximo 1500 caracteres", "no máximo 2000 caracteres")
  .replaceAll("no máximo 1.500 caracteres", "no máximo 2.000 caracteres");

const hasLimit =
  dist.includes("MAX_PROMPT_LENGTH = 2000") ||
  dist.includes("MAX_PROMPT_LENGTH=2000");

if (!hasLimit) {
  throw new Error("Compiled image-motion 2,000-character limit marker was not found in dist/index.mjs");
}

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

if (dist === before && !hasLimit) {
  throw new Error("Compiled image-motion limit was not changed or confirmed");
}

writeFileSync(distUrl, dist, "utf8");
console.log("Compiled Railway API artifact now enforces the 2,000-character image-motion limit.");
