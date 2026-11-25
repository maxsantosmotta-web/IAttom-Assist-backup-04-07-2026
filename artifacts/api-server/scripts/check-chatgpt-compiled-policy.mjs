import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const help = read("../src/routes/help.ts");
const credits = read("../src/lib/credits.ts");
const externalHelp = read("../src/routes/externalHelpOperations.ts");
const externalVideo = read("../src/routes/externalVideoOperations.ts");
const external = read("../src/routes/externalOperations.ts");
const prompts = read("../src/routes/prompts.ts");

assert.match(help, /__externalChatGPTClerkId/);
assert.match(help, /const creditResult = await deductCredits\(chatUserId, "iattom_help"\)/);
assert.match(help, /if \(!\(req as typeof req & \{ __externalChatGPTClerkId\?: string \}\)\.__externalChatGPTClerkId\) \{/);
assert.match(help, /if \(!\(req as typeof req & \{ __externalChatGPTClerkId\?: string \}\)\.__externalChatGPTClerkId\) try/);
assert.match(credits, /iattom_help:\s*1/);
assert.match(externalHelp, /invokeExistingHelpForChatGPT/);
assert.match(externalHelp, /helpMessagesUsed:\s*sql/);
assert.match(externalHelp, /isolatedExternalWritesEnabled\(\)/);
assert.match(externalVideo, /duration: "8s"/);
assert.match(externalVideo, /durationSeconds: 8/);
assert.match(externalVideo, /isolatedExternalWritesEnabled\(\)/);
assert.match(external, /invokeExistingPromptGenerator/);
assert.match(external, /captureExistingStream/);
assert.match(external, /isolatedExternalWritesEnabled\(\)/);
assert.match(prompts, /invokeExistingPromptGenerator/);
assert.match(help, /invokeExistingHelpForChatGPT/);
console.log("ChatGPT isolated build invariants passed without generating materials or consuming credits.");
