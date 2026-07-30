import fs from "node:fs";

const targets = [
  new URL("../src/lib/credits.ts", import.meta.url),
  new URL("../src/lib/webhookHandlers.ts", import.meta.url),
];

const zeroCreativeCredits = `export const PLAN_CREATIVE_CREDITS = {
  free: 0,
  pro: 0,
  business: 0,
  agency: 0,
} as const;`;

const zeroCreativeCreditsRecord = `const PLAN_CREATIVE_CREDITS: Record<string, number> = {
  free: 0,
  pro: 0,
  business: 0,
  agency: 0,
};`;

for (const target of targets) {
  let source = fs.readFileSync(target, "utf8");

  if (target.pathname.endsWith("/credits.ts")) {
    source = source.replace(
      /export const PLAN_CREATIVE_CREDITS = \{[\s\S]*?\} as const;/,
      zeroCreativeCredits,
    );
    if (!source.includes(zeroCreativeCredits)) {
      throw new Error("Could not zero plan creative credits in credits.ts");
    }
  } else {
    source = source.replace(
      /const PLAN_CREATIVE_CREDITS: Record<string, number> = \{[\s\S]*?\};/,
      zeroCreativeCreditsRecord,
    );
    if (!source.includes(zeroCreativeCreditsRecord)) {
      throw new Error("Could not zero plan creative credits in webhookHandlers.ts");
    }
  }

  fs.writeFileSync(target, source);
}

console.log("Paid plans no longer grant automatic image credits; purchased extra image credits remain untouched.");
