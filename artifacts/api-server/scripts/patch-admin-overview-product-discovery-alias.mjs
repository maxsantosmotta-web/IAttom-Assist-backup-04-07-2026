import fs from "node:fs";

const analyticsPath = new URL("../src/routes/adminAnalyticsCanonical.ts", import.meta.url);
let source = fs.readFileSync(analyticsPath, "utf8");

const originalBlock = `  for (const row of postCutoffRows) {
    counts.set(row.module, (counts.get(row.module) ?? 0) + Number(row.count));
  }`;

const incorrectMergeBlock = `  for (const row of postCutoffRows) {
    const canonicalModule = row.module === "find_products" ? "product_discovery" : row.module;
    counts.set(canonicalModule, (counts.get(canonicalModule) ?? 0) + Number(row.count));
  }`;

const filteredBlock = `  for (const row of postCutoffRows) {
    if (row.module === "find_products") continue;
    counts.set(row.module, (counts.get(row.module) ?? 0) + Number(row.count));
  }`;

if (!source.includes('if (row.module === "find_products") continue;')) {
  if (source.includes(incorrectMergeBlock)) {
    source = source.replace(incorrectMergeBlock, filteredBlock);
  } else if (source.includes(originalBlock)) {
    source = source.replace(originalBlock, filteredBlock);
  } else {
    throw new Error("Admin Overview fake find_products series anchor not found");
  }
}

if (!source.includes('if (row.module === "find_products") continue;')) {
  throw new Error("Admin Overview fake find_products filter was not applied");
}
if (source.includes('row.module === "find_products" ? "product_discovery"')) {
  throw new Error("Incorrect find_products merge still present");
}

fs.writeFileSync(analyticsPath, source, "utf8");
console.log("Admin Overview excludes only the fake find_products series and preserves product_discovery unchanged.");
