import fs from "node:fs";

const path = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  `  const refundCalledRef = useRef(false);\n  const chargedFeatureRef = useRef<FeatureKey>("creativeImage1");\n\n  useEffect(() => {\n    if (status === "error" && !refundCalledRef.current) {\n      refundCalledRef.current = true;\n      fetch("/api/credits/refund", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ feature: chargedFeatureRef.current }),\n        credentials: "include",\n      }).catch(() => {});\n    }\n    if (status === "idle" || status === "generating") {\n      refundCalledRef.current = false;\n    }\n  }, [status]);\n\n`,
  "",
);

source = source.replace(
  `  const runGenerate = (charge: () => void) => {\n    chargedFeatureRef.current = featureKey;\n    generate("/api/ai/creative-ideas", {`,
  `  const runGenerate = (charge: () => void) => {\n    generate("/api/ai/creative-ideas", {`,
);

if (source.includes("refundCalledRef") || source.includes("chargedFeatureRef")) {
  throw new Error("Creative credit refund patch did not fully apply");
}

fs.writeFileSync(path, source);
console.log("Creative credits now charge only after successful generation; failed generations cannot add balance");
