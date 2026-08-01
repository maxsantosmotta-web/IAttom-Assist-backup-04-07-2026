import { readFileSync, writeFileSync } from "node:fs";

const creditsPath = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
const legacyPatchPath = new URL("./patch-dashboard-runtime.mjs", import.meta.url);
const consolidatedCreditsSource = readFileSync(creditsPath, "utf8");

await import("./patch-dashboard-runtime.mjs");

writeFileSync(creditsPath, consolidatedCreditsSource);
writeFileSync(
  legacyPatchPath,
  'console.log("Dashboard runtime guards already applied safely; consolidated Credits.tsx preserved.");\n',
);
console.log("Dashboard runtime guards applied without rewriting consolidated Credits.tsx.");
