import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const label = "Descreva o efeito em movimento desejado";
const labelIndex = source.indexOf(label);

if (labelIndex >= 0) {
  const formStart = source.lastIndexOf('<CardContent className="p-6 space-y-6">', labelIndex);
  const formEnd = source.indexOf("</CardContent>", labelIndex);

  if (formStart >= 0 && formEnd >= 0) {
    let form = source.slice(formStart, formEnd);
    const hadLegacyLimit = /1200|1\.200/.test(form);

    if (hadLegacyLimit) {
      form = form
        .replace(/1200/g, "1500")
        .replace(/1\.200/g, "1.500");
      source = source.slice(0, formStart) + form + source.slice(formEnd);
      writeFileSync(creativeUrl, source, "utf8");
      console.log("Visible image-motion prompt limit updated to 1,500 characters.");
    } else {
      console.log("No frontend image-motion limit marker found; backend limit remains the source of truth.");
    }
  } else {
    console.log("Visible image-motion form boundary not found; backend limit remains the source of truth.");
  }
} else {
  console.log("Visible image-motion prompt label not found; backend limit remains the source of truth.");
}
