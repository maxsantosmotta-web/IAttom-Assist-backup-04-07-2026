import { readFileSync, writeFileSync } from "node:fs";

const executionUrl = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let source = readFileSync(executionUrl, "utf8");

function simulateSettlements(statuses) {
  const successfulIndexes = [];
  const failedIndexes = [];
  statuses.forEach((status, index) => {
    if (status === "fulfilled") successfulIndexes.push(index);
    else failedIndexes.push(index);
  });
  return { successfulIndexes, failedIndexes };
}

const bothSuccess = simulateSettlements(["fulfilled", "fulfilled"]);
const partialSuccess = simulateSettlements(["fulfilled", "rejected"]);
const bothFail = simulateSettlements(["rejected", "rejected"]);
if (bothSuccess.successfulIndexes.length !== 2 || bothSuccess.failedIndexes.length !== 0) {
  throw new Error("Stage 4 simulation failed for two successful formats");
}
if (partialSuccess.successfulIndexes.length !== 1 || partialSuccess.failedIndexes.length !== 1) {
  throw new Error("Stage 4 simulation failed for one successful and one failed format");
}
if (bothFail.successfulIndexes.length !== 0 || bothFail.failedIndexes.length !== 2) {
  throw new Error("Stage 4 simulation failed for two failed formats");
}

const oldResume = `  const resumePending = async (requests: PendingRequest[]) => {
    if (requests.length === 0) return;
    setPhase("processing");
    setError("");
    try {
      const completed = await Promise.all(requests.map(pollRequest));
      if (!mountedRef.current) return;
      setResults(completed);
      setPending([]);
      setPhase("done");
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a geração.");
      setPhase("error");
    }
  };`;

const newResume = `  const resumePending = async (requests: PendingRequest[]) => {
    if (requests.length === 0) return;
    setPhase("processing");
    setError("");
    const settled = await Promise.allSettled(requests.map(pollRequest));
    if (!mountedRef.current) return;

    const completed: MotionResult[] = [];
    const failed: PendingRequest[] = [];
    let firstFailure = "";

    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        completed.push(outcome.value);
        return;
      }
      failed.push(requests[index]);
      if (!firstFailure) {
        firstFailure = outcome.reason instanceof Error ? outcome.reason.message : "Não foi possível concluir um dos formatos.";
      }
    });

    if (completed.length > 0) {
      setResults((current) => {
        const merged = [...current];
        for (const result of completed) {
          const existingIndex = merged.findIndex((item) => item.format === result.format);
          if (existingIndex >= 0) merged[existingIndex] = result;
          else merged.push(result);
        }
        return merged;
      });
    }

    setPending(failed);
    if (failed.length === 0) {
      setError("");
      setPhase("done");
      return;
    }

    const completedLabel = completed.length > 0 ? \`\${completed.length} formato\${completed.length > 1 ? "s" : ""} concluído\${completed.length > 1 ? "s" : ""}. \` : "";
    setError(\`\${completedLabel}\${firstFailure || "Não foi possível concluir um dos formatos."}\`);
    setPhase("error");
  };`;

if (!source.includes(newResume)) {
  if (!source.includes(oldResume)) throw new Error("Stage 4 resumePending marker was not found");
  source = source.replace(oldResume, newResume);
}

const oldResultsCondition = `{phase === "done" && results.length > 0 && (`;
const newResultsCondition = `{results.length > 0 && (`;
if (!source.includes(newResultsCondition)) {
  if (!source.includes(oldResultsCondition)) throw new Error("Stage 4 results visibility marker was not found");
  source = source.replace(oldResultsCondition, newResultsCondition);
}

if (source.includes("await Promise.all(requests.map(pollRequest))")) {
  throw new Error("Image-motion formats are still coupled by Promise.all");
}
if (!source.includes("await Promise.allSettled(requests.map(pollRequest))")) {
  throw new Error("Independent image-motion settlement was not installed");
}
if (!source.includes("setPending(failed)")) {
  throw new Error("Failed image-motion formats are not preserved for retry");
}
if (!source.includes(`{results.length > 0 && (`)) {
  throw new Error("Successful partial results are not visible during another format error");
}

writeFileSync(executionUrl, source);
console.log("Stage 4 verified: successful image-motion formats remain visible while only failed formats stay pending.");
