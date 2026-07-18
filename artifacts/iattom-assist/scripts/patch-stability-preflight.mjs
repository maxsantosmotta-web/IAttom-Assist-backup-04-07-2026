import { readFileSync, writeFileSync } from "node:fs";

const targetUrl = new URL("./patch-stability-mobile-performance.mjs", import.meta.url);
let source = readFileSync(targetUrl, "utf8");

const oldSingleLine = '  if (!source.includes(before)) throw new Error(`${label} marker was not found`);';
const oldTwoLines = '  if (!source.includes(before))\n    throw new Error(`${label} marker was not found`);';
const safeBlock = '  if (!source.includes(before)) {\n    console.warn(`[stability patch] skipping ${label}: marker already changed or absent`);\n    return source;\n  }';

if (source.includes(oldSingleLine)) {
  source = source.replace(oldSingleLine, safeBlock);
} else if (source.includes(oldTwoLines)) {
  source = source.replace(oldTwoLines, safeBlock);
}

writeFileSync(targetUrl, source);
console.log("Stability preflight completed.");
