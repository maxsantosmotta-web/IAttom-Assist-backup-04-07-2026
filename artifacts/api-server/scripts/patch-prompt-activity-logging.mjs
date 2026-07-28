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
console.log("Prompt generation activity logging is connected without changing the generation flow.");
