import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/HelpPage.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const headings = [
  "Como ganhar créditos adicionais?",
  "Os créditos acumulam entre os meses?",
  "Como funciona o sistema de indicações?",
];

for (const heading of headings) {
  const index = source.indexOf(heading);
  if (index < 0) continue;

  const start = source.lastIndexOf('<div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">', index);
  if (start < 0) continue;

  const endMarker = "              </div>";
  const end = source.indexOf(endMarker, index);
  if (end < 0) continue;

  source = source.slice(0, start) + source.slice(end + endMarker.length);
}

source = source
  .replace(/Créditos bônus de indicação[^<]*\./g, "")
  .replace(/indicaç(?:ão|ões)/gi, "");

writeFileSync(fileUrl, source, "utf8");
console.log("Referral and referral-credit information removed from the public Help page.");

await import("./patch-start-visible-navigation-and-library-recovery.mjs");
