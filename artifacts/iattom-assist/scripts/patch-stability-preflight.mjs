import { readFileSync, writeFileSync } from "node:fs";

const targetUrl = new URL("./patch-stability-mobile-performance.mjs", import.meta.url);
let source = readFileSync(targetUrl, "utf8");

const fatalLine = '  if (!source.includes(before)) throw new Error(`${label} marker was not found`);';
const safeBlock = `  if (!source.includes(before)) {
    console.warn(\`[stability patch] skipping \${label}: marker already changed or absent\`);
    return source;
  }`;

if (source.includes(fatalLine)) {
  source = source.replace(fatalLine, safeBlock);
  writeFileSync(targetUrl, source);
  console.log("Stability patch made idempotent for this build.");
} else {
  console.log("Stability patch is already idempotent.");
}
