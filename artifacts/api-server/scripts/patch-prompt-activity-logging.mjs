import { readFileSync, writeFileSync } from "node:fs";

const routeUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(routeUrl, "utf8");

if (!source.includes('import { logAiUsage } from "../lib/ai/logger.js";')) {
  source = source.replace(
    'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";',
    'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";\nimport { logAiUsage } from "../lib/ai/logger.js";',
  );
}

source = source.replace(
  'router.post("/prompts/generate", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {\n  const parsed = GeneratePromptBody.safeParse(req.body);',
  'router.post("/prompts/generate", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {\n  const { clerkUserId } = req as AuthenticatedRequest;\n  const parsed = GeneratePromptBody.safeParse(req.body);',
);

if (!source.includes('module: "prompts"')) {
  source = source.replace(
    '    res.json({\n      title: titleMatch[1].trim().slice(0, 120),\n      prompt: promptMatch[1].trim(),\n      module,\n    });',
    '    const generatedTitle = titleMatch[1].trim().slice(0, 120);\n    await logAiUsage({\n      clerkUserId,\n      action: `Prompt criado: ${generatedTitle}`,\n      module: "prompts",\n      projectName: generatedTitle,\n    });\n\n    res.json({\n      title: generatedTitle,\n      prompt: promptMatch[1].trim(),\n      module,\n    });',
  );
}

const required = [
  'import { logAiUsage } from "../lib/ai/logger.js";',
  'const { clerkUserId } = req as AuthenticatedRequest;',
  'module: "prompts"',
  'action: `Prompt criado: ${generatedTitle}`',
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Prompt activity marker missing: ${marker}`);
}

writeFileSync(routeUrl, source);

const adminUrl = new URL("../src/routes/admin.ts", import.meta.url);
let adminSource = readFileSync(adminUrl, "utf8");

const analyticsQuery = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)
    .orderBy(desc(count()));`;
const analyticsQueryWithoutLegacyPrompt = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)
    .orderBy(desc(count()));`;

if (adminSource.includes(analyticsQuery)) {
  adminSource = adminSource.replace(analyticsQuery, analyticsQueryWithoutLegacyPrompt);
}

const genericFeatureName = '    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),';
const canonicalPromptFeatureName = '    name: r.module === "prompts" ? "Criar Prompt" : r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),';

if (adminSource.includes(genericFeatureName)) {
  adminSource = adminSource.replace(genericFeatureName, canonicalPromptFeatureName);
}

for (const marker of [
  '.where(ne(historyTable.module, "prompt"))',
  'r.module === "prompts" ? "Criar Prompt"',
]) {
  if (!adminSource.includes(marker)) {
    throw new Error(`Admin prompt analytics marker missing: ${marker}`);
  }
}

writeFileSync(adminUrl, adminSource);
console.log("Prompt activity uses the canonical prompts key; admin analytics excludes only the legacy prompt series.");
