import { readFileSync, writeFileSync } from "node:fs";

const imageMotionUrl = new URL("../src/routes/imageMotion.ts", import.meta.url);
const billingUrl = new URL("../src/routes/videoEffectBilling.ts", import.meta.url);
const clientUrl = new URL("../src/lib/falImageMotionClient.ts", import.meta.url);

let imageMotion = readFileSync(imageMotionUrl, "utf8");
let billing = readFileSync(billingUrl, "utf8");
let client = readFileSync(clientUrl, "utf8");

imageMotion = imageMotion
  .replace(/const\s+MAX_PROMPT_LENGTH\s*=\s*1200\s*;/g, "const MAX_PROMPT_LENGTH = 2000;")
  .replaceAll('duration: "6s"', 'duration: "8s"')
  .replaceAll('duration: 6, format', 'duration: 8, format');

billing = billing
  .replace(/const\s+MAX_PROMPT_LENGTH\s*=\s*1200\s*;/g, "const MAX_PROMPT_LENGTH = 2000;")
  .replaceAll('duration: "6s"', 'duration: "8s"')
  .replaceAll('duration: 6, format', 'duration: 8, format');

client = client.replace(
  'export type ImageMotionDuration = "6s";',
  'export type ImageMotionDuration = "8s";',
);

for (const [name, source] of [
  ["imageMotion.ts", imageMotion],
  ["videoEffectBilling.ts", billing],
]) {
  if (!source.includes("const MAX_PROMPT_LENGTH = 2000;")) {
    throw new Error(`${name}: 2,000-character limit was not applied`);
  }
  if (source.includes("MAX_PROMPT_LENGTH = 1200")) {
    throw new Error(`${name}: obsolete 1,200-character limit remains`);
  }
  if (!source.includes('duration: "8s"') || !source.includes("duration: 8")) {
    throw new Error(`${name}: 8-second duration was not applied`);
  }
  if (source.includes('duration: "6s"') || source.includes("duration: 6")) {
    throw new Error(`${name}: obsolete 6-second duration remains`);
  }
}

if (!client.includes('export type ImageMotionDuration = "8s";')) {
  throw new Error("falImageMotionClient.ts: 8-second duration type was not applied");
}
if (client.includes('export type ImageMotionDuration = "6s";')) {
  throw new Error("falImageMotionClient.ts: obsolete 6-second duration type remains");
}

writeFileSync(imageMotionUrl, imageMotion, "utf8");
writeFileSync(billingUrl, billing, "utf8");
writeFileSync(clientUrl, client, "utf8");

console.log("Image-motion source confirmed at 2,000 characters and 8 seconds before API build.");
