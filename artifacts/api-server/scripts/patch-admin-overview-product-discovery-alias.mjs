import fs from "node:fs";

const analyticsPath = new URL("../src/routes/adminAnalyticsCanonical.ts", import.meta.url);
let source = fs.readFileSync(analyticsPath, "utf8");

const oldBlock = `  for (const row of postCutoffRows) {
    counts.set(row.module, (counts.get(row.module) ?? 0) + Number(row.count));
  }`;

const canonicalBlock = `  for (const row of postCutoffRows) {
    const canonicalModule = row.module === "find_products" ? "product_discovery" : row.module;
    counts.set(canonicalModule, (counts.get(canonicalModule) ?? 0) + Number(row.count));
  }`;

if (!source.includes("row.module === \"find_products\" ? \"product_discovery\"")) {
  if (!source.includes(oldBlock)) {
    throw new Error("Admin overview product-discovery alias anchor not found");
  }
  source = source.replace(oldBlock, canonicalBlock);
}

for (const marker of [
  'row.module === "find_products" ? "product_discovery"',
  "counts.set(canonicalModule",
]) {
  if (!source.includes(marker)) {
    throw new Error(`Admin overview product-discovery alias marker missing: ${marker}`);
  }
}

fs.writeFileSync(analyticsPath, source, "utf8");
console.log("Admin Overview merges find_products into product_discovery without changing activity history.");
