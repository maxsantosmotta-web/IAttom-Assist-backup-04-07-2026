import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const label = "Descreva o efeito em movimento desejado";
const labelIndex = source.indexOf(label);
if (labelIndex < 0) throw new Error("Visible image-motion prompt label was not found");

const formStart = source.lastIndexOf('<CardContent className="p-6 space-y-6">', labelIndex);
const formEnd = source.indexOf("</CardContent>", labelIndex);
if (formStart < 0 || formEnd < 0) throw new Error("Visible image-motion form boundaries were not found");

let form = source.slice(formStart, formEnd);
const hadLegacyLimit = /1200|1\.200/.test(form);
form = form
  .replace(/1200/g, "1500")
  .replace(/1\.200/g, "1.500");

if (!hadLegacyLimit && !/1500|1\.500/.test(form)) {
  throw new Error("Image-motion prompt limit marker was not found inside the visible form");
}

if (/1200|1\.200/.test(form)) {
  throw new Error("Legacy 1,200-character limit is still present inside the visible image-motion form");
}

if (!/1500|1\.500/.test(form)) {
  throw new Error("Final 1,500-character limit is missing inside the visible image-motion form");
}

source = source.slice(0, formStart) + form + source.slice(formEnd);
writeFileSync(creativeUrl, source, "utf8");
console.log("Visible image-motion prompt limit is now 1,500 characters.");
