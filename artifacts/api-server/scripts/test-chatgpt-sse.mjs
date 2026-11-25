import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const source = readFileSync(new URL("../src/lib/chatgpt/captureExistingStream.ts", import.meta.url), "utf8");
const transpiled = await transform(source, { loader: "ts", format: "esm" });
const { captureExistingStream } = await import("data:text/javascript;base64," + Buffer.from(transpiled.code).toString("base64"));

function runEvents(parts, { terminate = true } = {}) {
  return async sink => {
    sink.setHeader("Content-Type", "text/event-stream");
    for (const part of parts) sink.write(part);
    if (terminate) sink.end();
  };
}
const start = 'data: {"type":"start"}\n\n';
const good = 'data: {"type":"result","data":{"headline":"ok"}}\n\n';
const done = 'data: {"type":"done"}\n\n';

test("captures split SSE frames and a completed result", async () => {
  const value = await captureExistingStream(runEvents([start, good.slice(0, 13), good.slice(13), done]));
  assert.deepEqual(value, { headline: "ok" });
});
test("allows interleaved chunks but requires result plus completion", async () => {
  await assert.rejects(captureExistingStream(runEvents([start, 'data: {"type":"chunk","content":"text"}\n\n', done])), /did not finish/);
});
test("rejects provider errors without returning any partial result", async () => {
  await assert.rejects(captureExistingStream(runEvents([start, good, 'data: {"type":"error","message":"failed"}\n\n', done])), /returned an error/);
});
test("rejects missing termination, truncated frames and duplicate output", async () => {
  await assert.rejects(captureExistingStream(runEvents([start, good, done], { terminate: false })), /did not finish/);
  await assert.rejects(captureExistingStream(runEvents([start, good, 'data: {"type":"don'])), /incomplete SSE frame/);
  await assert.rejects(captureExistingStream(runEvents([start, good, good, done])), /duplicate results/);
});
test("enforces output byte ceiling", async () => {
  await assert.rejects(captureExistingStream(runEvents([start, good, done]), 15), /too large/);
});

const isolationSource = readFileSync(new URL("../src/lib/chatgpt/isolation.ts", import.meta.url), "utf8");
const compiledIsolation = await transform(isolationSource, { loader: "ts", format: "esm" });
const { isolatedExternalWritesEnabled } = await import("data:text/javascript;base64," +
  Buffer.from(compiledIsolation.code).toString("base64"));

const sandboxUrl = "postgresql://tester:fake@postgres.railway.internal:5432/railway";
const complete = {
  CHATGPT_OPERATIONS_ENABLED: "true",
  CHATGPT_EXTERNAL_WRITES_ENABLED: "true",
  CHATGPT_EXTERNAL_ISOLATED_DB: "true",
  RAILWAY_PROJECT_ID: "0ded634b-c643-4655-b252-60c438c10b62",
  RAILWAY_ENVIRONMENT_ID: "32965107-60c2-4259-966b-38f8fed7a00b",
  DATABASE_URL: sandboxUrl,
  CHATGPT_SANDBOX_DATABASE_URL: sandboxUrl,
};
test("external operations require exact Railway test identity and matching private database", () => {
  assert.equal(isolatedExternalWritesEnabled(complete), true);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, CHATGPT_EXTERNAL_WRITES_ENABLED: "false" }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, RAILWAY_PROJECT_ID: "other-project" }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, RAILWAY_ENVIRONMENT_ID: "08959294-7371-49d2-82b0-471f45166edb" }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, CHATGPT_SANDBOX_DATABASE_URL: undefined }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, DATABASE_URL: "postgresql://tester:fake@production.example:5432/railway" }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, DATABASE_URL: "postgresql://tester:fake@postgres.railway.internal:5432/other" }), false);
  assert.equal(isolatedExternalWritesEnabled({ ...complete, CHATGPT_PRODUCTION_DATABASE_URL: sandboxUrl }), false);
});

const creativeSource = readFileSync(new URL("../src/lib/chatgpt/creativeDelivery.ts", import.meta.url), "utf8");
const compiledCreative = await transform(creativeSource, { loader: "ts", format: "esm" });
const { deliveredCreativeAssets } = await import("data:text/javascript;base64," +
  Buffer.from(compiledCreative.code).toString("base64"));

test("creative delivery rejects partial and invalid image batches without debit", () => {
  const base64 = "aGVsbG8gdGhpcyBpcyBhIHRlc3Q=";
  const make = (count) => ({ concepts: Array.from({ length: count }, (_, i) => ({ format: "feed", imageBase64: base64, label: String(i) })) });
  assert.throws(() => deliveredCreativeAssets(make(1), 2), /incomplete_creative_delivery/);
  assert.throws(() => deliveredCreativeAssets(make(2), 3), /incomplete_creative_delivery/);
  assert.throws(() => deliveredCreativeAssets({ concepts: [{ format: "feed" }] }, 1), /incomplete_creative_delivery/);
  assert.throws(() => deliveredCreativeAssets(make(2), 0), /invalid_requested_image_count/);
  const success = deliveredCreativeAssets(make(2), 2);
  assert.equal(success.assets.length, 2);
  assert.equal(success.assets[0].base64, base64);
  assert.equal("imageBase64" in success.safeResult.concepts[0], false);
});
