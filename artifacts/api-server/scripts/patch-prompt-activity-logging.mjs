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

function routeBlock(startMarker, endMarker) {
  const start = adminSource.indexOf(startMarker);
  const end = adminSource.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error(`Admin route boundary missing: ${startMarker}`);
  }
  return { start, end, block: adminSource.slice(start, end) };
}

function replaceRouteBlock(startMarker, endMarker, transform) {
  const { start, end, block } = routeBlock(startMarker, endMarker);
  const next = transform(block);
  adminSource = adminSource.slice(0, start) + next + adminSource.slice(end);
}

replaceRouteBlock(
  'router.get("/admin/activity"',
  'router.delete("/admin/activity/:id"',
  (block) => {
    if (block.includes('ne(historyTable.module, "prompt")')) return block;
    const withDeletedFilter = '.where(isNull(historyTable.deletedAt))';
    if (!block.includes(withDeletedFilter)) {
      throw new Error("Admin activity deleted-at filter anchor missing");
    }
    return block.replace(
      withDeletedFilter,
      '.where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt")))',
    );
  },
);

replaceRouteBlock(
  'router.get("/admin/analytics"',
  'router.get("/admin/launch-status"',
  (block) => {
    if (block.includes('ne(historyTable.module, "prompt")')) return block;

    const withDeletedFilter = `.from(historyTable)
    .where(isNull(historyTable.deletedAt))
    .groupBy(historyTable.module)`;
    if (block.includes(withDeletedFilter)) {
      return block.replace(
        withDeletedFilter,
        `.from(historyTable)
    .where(and(isNull(historyTable.deletedAt), ne(historyTable.module, "prompt")))
    .groupBy(historyTable.module)`,
      );
    }

    const withoutDeletedFilter = `.from(historyTable)
    .groupBy(historyTable.module)`;
    if (block.includes(withoutDeletedFilter)) {
      return block.replace(
        withoutDeletedFilter,
        `.from(historyTable)
    .where(ne(historyTable.module, "prompt"))
    .groupBy(historyTable.module)`,
      );
    }

    throw new Error("Admin analytics module query anchor missing");
  },
);

for (const [startMarker, endMarker, routeName] of [
  ['router.get("/admin/activity"', 'router.delete("/admin/activity/:id"', "activity"],
  ['router.get("/admin/analytics"', 'router.get("/admin/launch-status"', "analytics"],
]) {
  const { block } = routeBlock(startMarker, endMarker);
  if (!block.includes('ne(historyTable.module, "prompt")')) {
    throw new Error(`Legacy prompt filter missing inside admin ${routeName} route`);
  }
}

if (adminSource.includes('r.module === "prompts" ? "Criar Prompt"')) {
  adminSource = adminSource.replace(
    '    name: r.module === "prompts" ? "Criar Prompt" : r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),',
    '    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),',
  );
}

writeFileSync(adminUrl, adminSource);
console.log("Prompt activity uses the canonical prompts key; admin analytics and activity exclude only the legacy prompt key.");
