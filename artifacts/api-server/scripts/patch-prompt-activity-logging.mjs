import { readFileSync, writeFileSync } from "node:fs";

const routeUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(routeUrl, "utf8");

if (!source.includes('import { logAiUsage } from "../lib/ai/logger.js";')) {
  source = source.replace(
    'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";',
    'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";\nimport { logAiUsage } from "../lib/ai/logger.js";',
  );
}

const routeMarker = 'router.post("/prompts/generate", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {';
if (!source.includes('const { clerkUserId } = req as AuthenticatedRequest;')) {
  source = source.replace(
    `${routeMarker}\n  const parsed = GeneratePromptBody.safeParse(req.body);`,
    `${routeMarker}\n  const { clerkUserId } = req as AuthenticatedRequest;\n  const parsed = GeneratePromptBody.safeParse(req.body);`,
  );
}

if (!source.includes('module: "prompts"')) {
  const consolidatedResponse = `    res.json({\n      title: titleMatch[1].trim().slice(0, 120),\n      prompt: finalPrompt,\n      module,\n    });`;
  const legacyResponse = `    res.json({\n      title: titleMatch[1].trim().slice(0, 120),\n      prompt: promptMatch[1].trim(),\n      module,\n    });`;
  const replacement = `    const generatedTitle = titleMatch[1].trim().slice(0, 120);\n    await logAiUsage({\n      clerkUserId,\n      action: \`Prompt criado: \${generatedTitle}\`,\n      module: "prompts",\n      projectName: generatedTitle,\n    });\n\n    res.json({\n      title: generatedTitle,\n      prompt: ${source.includes(consolidatedResponse) ? "finalPrompt" : "promptMatch[1].trim()"},\n      module,\n    });`;

  if (source.includes(consolidatedResponse)) {
    source = source.replace(consolidatedResponse, replacement);
  } else if (source.includes(legacyResponse)) {
    source = source.replace(legacyResponse, replacement);
  } else {
    throw new Error("Prompt activity response marker not found in legacy or consolidated route");
  }
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
console.log("Prompt generation activity logging supports both legacy and consolidated routes.");
