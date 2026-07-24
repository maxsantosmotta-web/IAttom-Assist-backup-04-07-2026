import fs from "node:fs";

const path = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

source = source.replace("const MAX_FORMATS = 3;", "const MAX_FORMATS = 2;");

source = source.replace(
  `  const refundCalledRef = useRef(false);\n  const chargedFeatureRef = useRef<FeatureKey>("creativeImage1");\n\n  useEffect(() => {\n    if (status === "error" && !refundCalledRef.current) {\n      refundCalledRef.current = true;\n      fetch("/api/credits/refund", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ feature: chargedFeatureRef.current }),\n        credentials: "include",\n      }).catch(() => {});\n    }\n    if (status === "idle" || status === "generating") {\n      refundCalledRef.current = false;\n    }\n  }, [status]);\n\n`,
  "",
);

source = source.replace(
  `  const featureKey: FeatureKey =\n    selectedFormats.length <= 1 ? "creativeImage1" :\n    selectedFormats.length === 2 ? "creativeImage2" :\n    "creativeImage3";`,
  `  const featureKey: FeatureKey =\n    selectedFormats.length <= 1 ? "creativeImage1" : "creativeImage2";`,
);

const legacyRunGenerate = `  const runGenerate = (charge: () => void) => {\n    chargedFeatureRef.current = featureKey;\n    generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    }).then((res) => {\n      if (res !== null) charge();\n    });\n  };`;

const serverOnlyRunGenerate = `  const runGenerate = (_charge: () => void) => {\n    void generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    });\n  };`;

const directChargeRunGenerate = `  const runGenerate = (_charge: () => void) => {\n    void generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    }).then(async (res) => {\n      if (res === null) return;\n\n      const debitResponse = await fetch("/api/credits/use", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ feature: featureKey }),\n        credentials: "include",\n      });\n\n      if (!debitResponse.ok) {\n        const debitError = await debitResponse.json().catch(() => null) as { error?: string } | null;\n        toast({\n          title: "Falha ao registrar o consumo da imagem",\n          description: debitError?.error ?? "Atualize a página e tente novamente.",\n          variant: "destructive",\n        });\n        return;\n      }\n\n      await refetchCredits();\n    });\n  };`;

const finalRunGenerate = `  const runGenerate = (_charge: () => void) => {\n    void generate("/api/ai/creative-ideas", {\n      prompt,\n      platform,\n      selectedFormats,\n    });\n  };`;

if (source.includes(legacyRunGenerate)) {
  source = source.replace(legacyRunGenerate, finalRunGenerate);
} else if (source.includes(directChargeRunGenerate)) {
  source = source.replace(directChargeRunGenerate, finalRunGenerate);
} else if (!source.includes(serverOnlyRunGenerate)) {
  throw new Error("Creative generator runGenerate marker not found");
}

const streamAnchor = `  const { status, result, error, generate, reset } = useAiStream<CreativeIdeasResult>();`;
const streamWithDebitRef = `${streamAnchor}\n  const chargedResultRef = useRef<CreativeIdeasResult | null>(null);`;
if (!source.includes("const chargedResultRef = useRef<CreativeIdeasResult | null>(null);")) {
  if (!source.includes(streamAnchor)) throw new Error("Creative stream anchor not found");
  source = source.replace(streamAnchor, streamWithDebitRef);
}

const featureBlock = `  const featureKey: FeatureKey =\n    selectedFormats.length <= 1 ? "creativeImage1" : "creativeImage2";`;
const debitEffect = `\n\n  useEffect(() => {\n    if (status !== "done" || !result || chargedResultRef.current === result) return;\n    chargedResultRef.current = result;\n\n    void (async () => {\n      try {\n        const debitResponse = await fetch("/api/credits/use", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ feature: featureKey }),\n          credentials: "include",\n        });\n\n        if (!debitResponse.ok) {\n          const debitError = await debitResponse.json().catch(() => null) as { error?: string } | null;\n          toast({\n            title: "Falha ao registrar o consumo da imagem",\n            description: debitError?.error ?? "A imagem foi entregue, mas o consumo não foi registrado.",\n            variant: "destructive",\n          });\n          return;\n        }\n\n        await refetchCredits();\n      } catch {\n        toast({\n          title: "Falha ao registrar o consumo da imagem",\n          description: "A imagem foi entregue, mas não foi possível atualizar o saldo.",\n          variant: "destructive",\n        });\n      }\n    })();\n  }, [status, result, featureKey, refetchCredits, toast]);`;

if (!source.includes("chargedResultRef.current === result")) {
  if (!source.includes(featureBlock)) throw new Error("Creative feature block anchor not found");
  source = source.replace(featureBlock, `${featureBlock}${debitEffect}`);
}

if (source.includes("refundCalledRef") || source.includes("chargedFeatureRef")) {
  throw new Error("Creative credit integrity patch did not remove legacy refund state");
}

if (!source.includes("chargedResultRef.current === result") || !source.includes('fetch("/api/credits/use"')) {
  throw new Error("Creative generator post-delivery debit was not installed");
}

if (source.includes('"creativeImage3"') || source.includes("const MAX_FORMATS = 3;")) {
  throw new Error("Creative generator must support only 1 or 2 images");
}

fs.writeFileSync(path, source);
console.log("Creative generator debits exactly once only after a completed image result");
