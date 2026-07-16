import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let source = readFileSync(path, "utf8");

const replacements = [
  [
    "{creditsData.planLimit.toLocaleString()}",
    "{(creditsData?.planLimit ?? 0).toLocaleString()}",
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before) && !source.includes(after)) {
    throw new Error(`Expected dashboard expression was not found: ${before}`);
  }
  source = source.replace(before, after);
}

writeFileSync(path, source);
console.log("Dashboard runtime source verified and normalized.");
