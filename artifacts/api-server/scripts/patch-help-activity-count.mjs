import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/routes/help.ts", import.meta.url);
let source = readFileSync(helpUrl, "utf8");

const importLine = 'import { logAiUsage } from "../lib/ai/logger.js";';
if (!source.includes(importLine)) {
  const anchor = 'import { semanticNormalize } from "../lib/ai/semanticNormalize.js";';
  if (!source.includes(anchor)) throw new Error("Help import anchor not found");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const marker = 'await logAiUsage({ clerkUserId: chatUserId, action: "IAttom Help utilizado", module: "help" });';
if (!source.includes(marker)) {
  const anchor = `  // Increment help usage counter\n  try {\n    await db.update(users)\n      .set({ helpMessagesUsed: sql\`\${users.helpMessagesUsed} + 1\`, updatedAt: new Date() })\n      .where(eq(users.clerkId, chatUserId));\n  } catch (err) {\n    req.log.warn({ msg: "Failed to increment help usage counter", err });\n  }\n\n  sendSSEDone(res);`;
  if (!source.includes(anchor)) throw new Error("Help success counter anchor not found");
  source = source.replace(anchor, `  // Increment help usage counter\n  try {\n    await db.update(users)\n      .set({ helpMessagesUsed: sql\`\${users.helpMessagesUsed} + 1\`, updatedAt: new Date() })\n      .where(eq(users.clerkId, chatUserId));\n  } catch (err) {\n    req.log.warn({ msg: "Failed to increment help usage counter", err });\n  }\n\n  await logAiUsage({ clerkUserId: chatUserId, action: "IAttom Help utilizado", module: "help" });\n\n  sendSSEDone(res);`);
}

if (!source.includes(importLine) || !source.includes(marker)) {
  throw new Error("Help activity patch validation failed");
}

writeFileSync(helpUrl, source);
console.log("Successful IAttom Help responses are counted in activity analytics.");
