import type { Response } from "express";

/**
 * Capture an existing IAttom SSE generator without streaming unbilled data to
 * the external client. It only succeeds after exactly one result and a done
 * event. Reject generator errors, truncated streams and oversized output.
 */
export async function captureExistingStream(
  run: (res: Response) => Promise<void>,
  maxBytes = 3_000_000,
): Promise<unknown> {
  let bytes = 0;
  let ended = false;
  let done = false;
  let resultSeen = false;
  let resultData: unknown;
  let generatorError = false;
  let remainder = "";

  function consumeEvent(raw: string): void {
    const data = raw.split("\n").filter(line => line.startsWith("data: "))
      .map(line => line.slice(6)).join("\n");
    if (!data) return;
    const event = JSON.parse(data) as Record<string, unknown>;
    if (event.type === "error") generatorError = true;
    if (event.type === "result") {
      if (resultSeen) throw new Error("Generator produced duplicate results");
      resultSeen = true;
      resultData = event.data;
    }
    if (event.type === "done") {
      if (done) throw new Error("Generator produced duplicate completion");
      done = true;
    }
  }

  const sink = {
    setHeader: () => sink,
    write(chunk: unknown) {
      if (ended) throw new Error("Generator wrote after ending response");
      const text = String(chunk).replace(/\r\n/g, "\n");
      bytes += Buffer.byteLength(text);
      if (bytes > maxBytes) throw new Error("Generator response too large");
      remainder += text;
      for (let separator = remainder.indexOf("\n\n"); separator >= 0;
           separator = remainder.indexOf("\n\n")) {
        consumeEvent(remainder.slice(0, separator));
        remainder = remainder.slice(separator + 2);
      }
      return true;
    },
    end() { ended = true; return sink; },
  };

  await run(sink as unknown as Response);
  if (remainder.trim()) throw new Error("Generator ended with incomplete SSE frame");
  if (generatorError) throw new Error("Existing generator returned an error");
  if (!ended || !done || !resultSeen || resultData === undefined) {
    throw new Error("Existing generator did not finish successfully");
  }
  return resultData;
}
