import fs from "node:fs";

const path = new URL("../src/lib/ai/creativeIdeas.ts", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import { buildRefinedContext } from "./interpretationEngine.js";';
const creditImport = 'import { deductCredits, type FeatureKey } from "../credits.js";';

if (!source.includes(creditImport)) {
  if (!source.includes(importAnchor)) {
    throw new Error("Creative server charge patch: import anchor not found");
  }
  source = source.replace(importAnchor, `${importAnchor}\n${creditImport}`);
}

const resultAnchor = `    const finalResult: CreativeIdeasResult = {
      visualAnchor,
      concepts: conceptsWithImages,
    };

    sendSSE(res, { type: "result", data: finalResult });`;

const chargedResult = `    const successfulImageCount = conceptsWithImages.filter((concept) => Boolean(concept.imageBase64)).length;
    const chargeFeature: FeatureKey = successfulImageCount <= 1
      ? "creativeImage1"
      : successfulImageCount === 2
        ? "creativeImage2"
        : "creativeImage3";

    const debit = await deductCredits(clerkUserId, chargeFeature);
    if (!debit.success) {
      sendSSEError(
        res,
        debit.error === "insufficient_credits"
          ? "Saldo de imagens insuficiente. Atualize seu saldo e tente novamente."
          : "Não foi possível registrar o consumo das imagens. Tente novamente.",
      );
      return;
    }

    const finalResult: CreativeIdeasResult = {
      visualAnchor,
      concepts: conceptsWithImages,
    };

    sendSSE(res, { type: "result", data: finalResult });`;

if (!source.includes("const successfulImageCount = conceptsWithImages.filter")) {
  if (!source.includes(resultAnchor)) {
    throw new Error("Creative server charge patch: result anchor not found");
  }
  source = source.replace(resultAnchor, chargedResult);
}

if (!source.includes(creditImport) || !source.includes("await deductCredits(clerkUserId, chargeFeature)")) {
  throw new Error("Creative server charge patch did not fully apply");
}

fs.writeFileSync(path, source);
console.log("Creative image usage is now charged authoritatively on the server after successful generation");
