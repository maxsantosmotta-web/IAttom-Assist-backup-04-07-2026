import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);

let creative = readFileSync(creativeUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");

creative = creative
  .replace(
    "const canOpenImageMotion = isAdmin || (videoBalance ?? 0) > 0;",
    "const canOpenImageMotion = true;",
  )
  .replace(
    'if (!isAdmin && !["pro", "business", "agency"].includes(planSlug)) return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Imagem e Vídeo" />;',
    'if (false && !isAdmin && !["pro", "business", "agency"].includes(planSlug)) return <ModuleLockGate allowedPlans={["pro", "business", "agency"]} moduleName="Criar Imagem e Vídeo" />;',
  );

billing = billing.replace(
  `  const handleBuyVideoPack = async (packId: string) => {
    if (currentPlan === "free") {
      setShowComparison(true);
      return;
    }
    setVideoPending(packId);`,
  `  const handleBuyVideoPack = async (packId: string) => {
    setVideoPending(packId);`,
);

for (const marker of [
  "const canOpenImageMotion = true;",
  "if (false && !isAdmin",
  "const handleBuyVideoPack = async (packId: string) => {\n    setVideoPending(packId);",
]) {
  if (!(creative + billing).includes(marker)) {
    throw new Error(`Final commercial video unlock missing: ${marker}`);
  }
}

writeFileSync(creativeUrl, creative);
writeFileSync(billingUrl, billing);
console.log("Video package checkout and Criar Imagem e Vídeo module unlocked for FREE commercial-test accounts.");
