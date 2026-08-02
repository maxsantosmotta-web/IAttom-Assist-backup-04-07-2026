import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/imageMotion.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const current = "const MAX_PROMPT_LENGTH = 1500;";
const legacyPattern = /const\s+MAX_PROMPT_LENGTH\s*=\s*1200\s*;/g;

source = source.replace(legacyPattern, current);

if (!source.includes(current)) {
  throw new Error("Image-motion backend 1,500-character limit was not applied");
}
if (legacyPattern.test(source) || /MAX_PROMPT_LENGTH\s*=\s*1200/.test(source)) {
  throw new Error("Image-motion backend still contains the obsolete 1,200-character limit");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Image-motion backend runtime confirmed at 1,500 characters before API build.");
