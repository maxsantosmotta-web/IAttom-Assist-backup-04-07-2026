import { readFileSync, writeFileSync } from "node:fs";

const executionUrl = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let source = readFileSync(executionUrl, "utf8");

const limitedLoop = `        for (let attempt = 0; attempt < 4; attempt += 1) {
          response = await fetch("/api/image-motion/submit", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl, prompt: prompt.trim(), format }),
          });
          if (response.ok) break;
          submitMessage = await readError(response, submitMessage);
          const temporaryLimit = response.status === 429 || /muitas requisições|aguarde um momento|rate limit/i.test(submitMessage);
          if (!temporaryLimit || attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS * (attempt + 1), 12_000)));
        }`;

const continuousLoop = `        let rateLimitAttempt = 0;
        while (true) {
          response = await fetch("/api/image-motion/submit", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl, prompt: prompt.trim(), format }),
          });
          if (response.ok) break;
          submitMessage = await readError(response, submitMessage);
          const temporaryLimit = response.status === 429 || /muitas requisições|aguarde um momento|rate limit/i.test(submitMessage);
          if (!temporaryLimit) break;
          rateLimitAttempt += 1;
          await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS * Math.max(rateLimitAttempt, 1), 12_000)));
        }`;

if (!source.includes(continuousLoop)) {
  if (!source.includes(limitedLoop)) {
    throw new Error("Image-motion limited submit retry loop was not found");
  }
  source = source.replace(limitedLoop, continuousLoop);
}

if (source.includes("attempt === 3")) {
  throw new Error("Image-motion submit still stops after four rate-limit responses");
}
if (!source.includes("while (true)") || !source.includes("rateLimitAttempt += 1")) {
  throw new Error("Image-motion continuous rate-limit loading was not installed");
}
if (!source.includes("if (response.ok) break;")) {
  throw new Error("Image-motion submit success exit is missing");
}

writeFileSync(executionUrl, source, "utf8");
console.log("Image-motion submit now remains loading through explicit rate limits until the request is accepted, without creating another execution after a requestId exists.");
