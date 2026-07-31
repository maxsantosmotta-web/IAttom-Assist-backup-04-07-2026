import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/imageMotion.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const legacy = "const MAX_PROMPT_LENGTH = 1200;";
const current = "const MAX_PROMPT_LENGTH = 1500;";

if (source.includes(legacy)) {
  source = source.replace(legacy, current);
}

if (!source.includes(current)) {
  throw new Error("Image-motion backend 1,500-character limit was not applied");
}
if (source.includes(legacy)) {
  throw new Error("Image-motion backend still contains the obsolete 1,200-character limit");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Image-motion backend now accepts prompts up to 1,500 characters.");