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
  await assert.rejects(captureExistingStream(runEvents([start, good, 'data: {"type":"don']), /incomplete SSE frame/);
  await assert.rejects(captureExistingStream(runEvents([start, good, good, done])), /duplicate results/);
});
test("enforces output byte ceiling", async () => {
  await assert.rejects(captureExistingStream(runEvents([start, good, done]), 15), /too large/);
});
