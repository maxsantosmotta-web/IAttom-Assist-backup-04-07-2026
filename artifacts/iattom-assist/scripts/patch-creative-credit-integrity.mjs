import fs from "node:fs";

const path = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  `  const refundCalledRef = useRef(false);\n  const chargedFeatureRef = useRef<FeatureKey>("creativeImage1");\n\n  useEffect(() => {\n    if (status === "error" && !refundCalledRef.current) {\n      refundCalledRef.current = true;\n      fetch("/api/credits/refund", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ feature: chargedFeatureRef.current }),\n        credentials: "include",\n      }).catch(() => {});\n    }\n    if (status === "idle" || status === "generating") {\n      refundCalledRef.current = false;\n    }\n  }, [status]);\n\n`,
  "",
);

source = source.replace(
  `  const runGenerate = (charge: () => void) => {\n    chargedFeatureRef.current = featureKey;\n    generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    }).then((res) => {\n      if (res !== null) charge();\n    });\n  };`,
  `  const runGenerate = (_charge: () => void) => {\n    void generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    });\n  };`,
);

if (source.includes("refundCalledRef") || source.includes("chargedFeatureRef")) {
  throw new Error("Creative credit integrity patch did not remove legacy client refund state");
}

if (!source.includes('const runGenerate = (_charge: () => void) => {') || source.includes("if (res !== null) charge();")) {
  throw new Error("Creative credit integrity patch did not disable duplicate client charge");
}

fs.writeFileSync(path, source);
console.log("Creative images are charged only by the server after successful generation; client duplicate charge is disabled");
