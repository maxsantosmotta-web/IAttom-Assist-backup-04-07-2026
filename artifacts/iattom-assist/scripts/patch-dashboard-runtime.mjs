import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");

  for (const [before, after] of replacements) {
    if (!source.includes(before) && !source.includes(after)) {
      throw new Error(`Expected runtime expression was not found in ${relativePath}: ${before}`);
    }
    source = source.replace(before, after);
  }

  writeFileSync(path, source);
}

patchFile("../src/components/layout/SidebarLayout.tsx", [
  [
    "{creditsData.planLimit.toLocaleString()}",
    "{(creditsData?.planLimit ?? 0).toLocaleString()}",
  ],
]);

patchFile("../src/pages/dashboard/Billing.tsx", [
  [
    "(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits).toLocaleString(\"pt-BR\") + \" créditos / mês\"",
    "(PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits ?? 0).toLocaleString(\"pt-BR\") + \" créditos / mês\"",
  ],
  [
    "((PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits) * 12).toLocaleString(\"pt-BR\") + \" créditos / ano\"",
    "((PLAN_CREDITS[planKey as keyof typeof PLAN_CREDITS] ?? plan.credits ?? 0) * 12).toLocaleString(\"pt-BR\") + \" créditos / ano\"",
  ],
]);

console.log("Post-login dashboard and billing runtime sources verified and normalized.");
