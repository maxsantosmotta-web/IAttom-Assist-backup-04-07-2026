import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

/**
 * Execute the actual TypeScript route handlers with a throw-on-access fake DB.
 * No Railway DB, Clerk, OpenAI, Stripe or Fal provider is ever contacted.
 */
const modules = [
  ["../src/routes/externalOperations.ts", ["/chatgpt/operations/execute"]],
  ["../src/routes/externalVideoOperations.ts", ["/chatgpt/video/submit", "/chatgpt/video/collect"]],
  ["../src/routes/externalHelpOperations.ts", ["/chatgpt/help/execute"]],
];

async function loadRoute(path) {
  const raw = readFileSync(new URL(path, import.meta.url), "utf8");
  // Only strip top-level imports; all handler bodies and route registrations
  // remain unchanged and are executed as part of this test.
  const noImports = raw.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, "");
  const stub = `
    const captured = [];
    const router = {
      get(path, ...handlers) { captured.push({ method: "GET", path, handler: handlers.at(-1) }); },
      post(path, ...handlers) { captured.push({ method: "POST", path, handler: handlers.at(-1) }); },
    };
    const Router = () => router;
    const requireExternalAccess = () => { throw Error("Middleware should not be invoked by this unit harness"); };
    const requirePlan = () => () => {};
    const isolatedExternalWritesEnabled = () => false;
    const db = new Proxy({}, { get() { throw Error("Database must not be accessed when writes disabled"); } });
    const users = {}, savedItemsTable = {}, creditsTransactions = {}, videoTransactions = {}, historyTable = {};
    const FEATURE_COSTS = {}, CREATIVE_FEATURES = new Set();
    const eq = () => { throw Error("DB function called"); };
    const and = () => { throw Error("DB function called"); };
    const sql = () => { throw Error("DB function called"); };
    const isNull = () => { throw Error("DB function called"); };
    const createHash = () => { throw Error("Crypto operation before write guard"); };
    const AiFindProductsBody = {}, AiValidateProductBody = {}, AiCreateCampaignBody = {},
      AiCreateContentBody = {}, AiVideoScriptBody = {}, AiCreativeIdeasBody = {};
    const invokeExistingPromptGenerator = () => { throw Error("Prompt should not execute"); };
    const invokeExistingHelpForChatGPT = () => { throw Error("Help should not execute"); };
    const streamFindProducts = () => { throw Error("Generation should not execute"); };
    const streamValidateProduct = streamFindProducts, streamCreateCampaign = streamFindProducts,
      streamCreateContent = streamFindProducts, streamVideoScript = streamFindProducts,
      streamCreativeIdeas = streamFindProducts;
    const captureExistingStream = streamFindProducts;
    const deliveredCreativeAssets = streamFindProducts;
    const getImageMotionResult = streamFindProducts, getImageMotionStatus = streamFindProducts,
      submitImageMotion = streamFindProducts;
    export { captured };
  `;
  // The module itself declares a router variable; remove that one declaration
  // so it uses the instrumented Router() once, without changing handlers.
  const compiled = await transform(stub.replace("const router = {", "const mockRouter = {").replace("() => router;", "() => mockRouter;") +
    noImports, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64"));
}

test("all external mutation handlers fail closed before database/provider access", async () => {
  for (const [path, expected] of modules) {
    const module = await loadRoute(path);
    for (const route of expected) {
      const hit = module.captured.find(r => r.method === "POST" && r.path === route);
      assert.ok(hit, `Missing external write route: ${route}`);
      const response = {
        code: 200,
        body: undefined,
        status(code) { this.code = code; return this; },
        json(data) { this.body = data; return this; },
      };
      await hit.handler({ body: {} }, response);
      assert.equal(response.code, 503, `Unexpected write access at ${route}`);
      assert.equal(response.body?.error, "isolated_external_writes_disabled");
    }
  }
});
