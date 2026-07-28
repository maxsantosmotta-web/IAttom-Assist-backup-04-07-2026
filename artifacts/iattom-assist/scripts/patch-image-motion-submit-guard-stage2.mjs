import { readFileSync, writeFileSync } from "node:fs";

const executionUrl = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let source = readFileSync(executionUrl, "utf8");

const mountedRefMarker = `  const mountedRef = useRef(true);`;
const guardedRefs = `${mountedRefMarker}\n  const submitInFlightRef = useRef(false);`;

if (!source.includes("submitInFlightRef")) {
  if (!source.includes(mountedRefMarker)) {
    throw new Error("Image-motion mounted ref marker was not found");
  }
  source = source.replace(mountedRefMarker, guardedRefs);
}

const generateStart = `  const generate = async () => {\n    if (!source || !canGenerate) return;\n    setPhase("submitting");`;
const guardedGenerateStart = `  const generate = async () => {\n    if (!source || !canGenerate || submitInFlightRef.current) return;\n    submitInFlightRef.current = true;\n    setPhase("submitting");`;

if (source.includes(generateStart)) {
  source = source.replace(generateStart, guardedGenerateStart);
} else if (!source.includes("if (!source || !canGenerate || submitInFlightRef.current) return;")) {
  throw new Error("Image-motion generate start marker was not found");
}

const generateEnd = `      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");\n      setPhase("error");\n    }\n  };`;
const guardedGenerateEnd = `      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");\n      setPhase("error");\n    } finally {\n      submitInFlightRef.current = false;\n    }\n  };`;

if (source.includes(generateEnd)) {
  source = source.replace(generateEnd, guardedGenerateEnd);
} else if (!source.includes("submitInFlightRef.current = false;")) {
  throw new Error("Image-motion generate completion marker was not found");
}

const resetMarker = `  const resetAll = () => {\n    setPhase("idle");`;
const guardedReset = `  const resetAll = () => {\n    submitInFlightRef.current = false;\n    setPhase("idle");`;

if (source.includes(resetMarker)) {
  source = source.replace(resetMarker, guardedReset);
} else if (!source.includes("const resetAll = () => {\n    submitInFlightRef.current = false;")) {
  throw new Error("Image-motion reset marker was not found");
}

if (!source.includes("submitInFlightRef.current = true;") ||
    !source.includes("submitInFlightRef.current = false;") ||
    !source.includes("if (!source || !canGenerate || submitInFlightRef.current) return;")) {
  throw new Error("Image-motion Stage 2 submit guard was not installed");
}

writeFileSync(executionUrl, source);
console.log("Image-motion Stage 2 blocks duplicate and concurrent submissions without changing recovery flows.");
