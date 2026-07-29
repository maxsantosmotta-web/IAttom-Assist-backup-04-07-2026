import { readFileSync, writeFileSync } from "node:fs";

const creditsLibUrl = new URL("../src/lib/credits.ts", import.meta.url);
const helpRouteUrl = new URL("../src/routes/help.ts", import.meta.url);

let creditsLib = readFileSync(creditsLibUrl, "utf8");
let helpRoute = readFileSync(helpRouteUrl, "utf8");

if (!creditsLib.includes("iattom_help: 1")) {
  creditsLib = creditsLib.replace(
    '  prompt_creation: 5,',
    '  prompt_creation: 5,\n  iattom_help: 1,',
  );
}
if (!creditsLib.includes('iattom_help: "Uso do IAttom Help"')) {
  creditsLib = creditsLib.replace(
    '  prompt_creation: "Criação de Prompt",',
    '  prompt_creation: "Criação de Prompt",\n  iattom_help: "Uso do IAttom Help",',
  );
}

helpRoute = helpRoute.replace(
  'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";',
  'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";\nimport { deductCredits, FEATURE_COSTS } from "../lib/credits.js";',
);

// Remove the independent quota table. The historical counter remains in users.helpMessagesUsed.
helpRoute = helpRoute.replace(
  /\/\/ ── Help usage limits per plan ─+[\s\S]*?const HELP_LIMITS: Record<string, number> = \{[\s\S]*?\};\n/,
  '// IAttom Help uses general credits. helpMessagesUsed remains a historical counter.\n',
);

// Usage endpoint now exposes historical usage only, without a separate allowance.
helpRoute = helpRoute.replace(
  /router\.get\("\/help\/usage"[\s\S]*?\n\}\);\n\n\/\/ ── Help chat/,
  `router.get("/help/usage", requireAuth, async (req, res): Promise<void> => {\n  const userId = getAuth(req)?.userId;\n  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }\n\n  try {\n    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));\n    if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }\n\n    res.json({\n      used: user.helpMessagesUsed,\n      limit: 0,\n      remaining: 0,\n      plan: user.plan,\n      creditCost: FEATURE_COSTS.iattom_help,\n    });\n  } catch (err) {\n    req.log.error({ msg: "Error fetching help usage", err });\n    res.status(500).json({ error: "Erro ao buscar uso do Help." });\n  }\n});\n\n// ── Help chat`,
);

// Replace the former plan quota block with a non-destructive general-credit availability check.
helpRoute = helpRoute.replace(
  /\s*\/\/ ── Help limit check ─+[\s\S]*?\/\/ ─+[\s\S]*?\n\n  \/\/ Abort signal/,
  `\n  const [userRecord] = await db.select().from(users).where(eq(users.clerkId, chatUserId));\n  if (!userRecord) { res.status(401).json({ error: "Usuário não encontrado." }); return; }\n\n  const helpCreditCost = FEATURE_COSTS.iattom_help;\n  const availableGeneralCredits = userRecord.credits + (userRecord.extraCredits ?? 0);\n  if (availableGeneralCredits < helpCreditCost) {\n    res.status(402).json({\n      error: "Créditos gerais insuficientes para usar o IAttom Help.",\n      code: "INSUFFICIENT_GENERAL_CREDITS",\n      balance: availableGeneralCredits,\n      required: helpCreditCost,\n    });\n    return;\n  }\n\n  // Abort signal`,
);

// Charge only after a completed response, preserving the current stream and error behavior.
const successMarker = `  // Increment help usage counter\n  try {`;
if (!helpRoute.includes(successMarker)) throw new Error("Help success counter marker not found");
helpRoute = helpRoute.replace(
  successMarker,
  `  const creditResult = await deductCredits(chatUserId, "iattom_help");\n  if (!creditResult.success) {\n    req.log.warn({ msg: "IAttom Help response completed but credit debit failed", chatUserId, result: creditResult });\n  }\n\n  // Increment help usage counter\n  try {`,
);

for (const marker of [
  "iattom_help: 1",
  'iattom_help: "Uso do IAttom Help"',
  'deductCredits(chatUserId, "iattom_help")',
  "INSUFFICIENT_GENERAL_CREDITS",
  "used: user.helpMessagesUsed",
]) {
  if (!creditsLib.includes(marker) && !helpRoute.includes(marker)) {
    throw new Error(`Help general-credit validation failed: ${marker}`);
  }
}
if (helpRoute.includes("HELP_LIMITS")) throw new Error("Independent Help quota still exists");

writeFileSync(creditsLibUrl, creditsLib);
writeFileSync(helpRouteUrl, helpRoute);
console.log("IAttom Help now consumes one general credit per completed response; historical usage retained.");
