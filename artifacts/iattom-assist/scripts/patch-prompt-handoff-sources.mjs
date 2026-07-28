import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchFile(relativePath, transform) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const next = transform(source);
  if (next === source) {
    console.log(`[prompt-handoff] unchanged: ${relativePath}`);
    return;
  }
  fs.writeFileSync(filePath, next);
  console.log(`[prompt-handoff] patched: ${relativePath}`);
}

function replaceRequired(source, marker, replacement, label) {
  if (!source.includes(marker)) {
    throw new Error(`[prompt-handoff] marker not found: ${label}`);
  }
  return source.replace(marker, replacement);
}

patchFile("src/pages/dashboard/CreateContent.tsx", (source) => {
  if (source.includes('from "@/components/PromptHandoffButton"')) return source;

  let next = replaceRequired(
    source,
    'import type { ContentResult } from "@/types/ai";',
    'import type { ContentResult } from "@/types/ai";\nimport { PromptHandoffButton } from "@/components/PromptHandoffButton";',
    "CreateContent import",
  );

  next = replaceRequired(
    next,
    '            <div className="flex items-center justify-between mb-4">',
    `            <div className="mb-4 flex justify-start">
              <PromptHandoffButton
                source="create_content"
                title={topic.trim() || activeResult.seoTitle || "Conteúdo gerado"}
                summary={[
                  \`Produto/Tópico: \${topic.trim() || activeResult.seoTitle || "Não informado"}\`,
                  \`Contexto: \${additionalContext.trim() || activeResult.seoDescription || "Não informado"}\`,
                  \`Mensagem principal: \${activeResult.seoTitle || activeResult.seoDescription || topic.trim()}\`,
                  "Objetivo visual: representar o produto ou tema de forma clara, coerente e fiel ao posicionamento.",
                ].join("\\n")}
                payload={{ topic, tone, additionalContext, seoTitle: activeResult.seoTitle, seoDescription: activeResult.seoDescription }}
                className="w-full sm:w-auto sm:max-w-[290px]"
              />
            </div>
            <div className="flex items-center justify-between mb-4">`,
    "CreateContent result header",
  );

  return next;
});

patchFile("src/pages/dashboard/FindProducts.tsx", (source) => {
  if (source.includes('from "@/components/PromptHandoffButton"')) return source;

  let next = replaceRequired(
    source,
    'import type { FindProductsResult, FoundProduct } from "@/types/ai";',
    'import type { FindProductsResult, FoundProduct } from "@/types/ai";\nimport { PromptHandoffButton } from "@/components/PromptHandoffButton";',
    "FindProducts import",
  );

  const rightColumnMarker = '<div className="shrink-0 flex flex-col items-end gap-2">';
  const rightColumnIndex = next.indexOf(rightColumnMarker, next.indexOf("product.keySellingPoints"));
  if (rightColumnIndex < 0) {
    throw new Error("[prompt-handoff] marker not found: FindProducts product right column");
  }

  const leftColumnEnd = next.lastIndexOf("</div>", rightColumnIndex);
  if (leftColumnEnd < 0) {
    throw new Error("[prompt-handoff] marker not found: FindProducts product left column end");
  }

  const buttonBlock = `
                          <div className="mt-4">
                            <PromptHandoffButton
                              source="find_products"
                              title={product.name}
                              summary={[
                                \`Produto: \${product.name}\`,
                                \`Categoria: \${product.category || niche || "Não informada"}\`,
                                \`Diferenciais: \${product.keySellingPoints?.slice(0, 3).join(", ") || product.whyNow || "Não informados"}\`,
                                \`Objetivo visual: criar uma imagem comercial fiel ao produto\${platform ? \` para \${platform}\` : ""}.\`,
                              ].join("\\n")}
                              payload={{ product, query, niche, platform }}
                              className="w-full sm:w-auto sm:max-w-[290px]"
                            />
                          </div>`;

  next = next.slice(0, leftColumnEnd) + buttonBlock + "\n                        " + next.slice(leftColumnEnd);
  return next;
});

patchFile("src/pages/dashboard/ValidateProducts.tsx", (source) => {
  if (source.includes('from "@/components/PromptHandoffButton"')) return source;

  let next = replaceRequired(
    source,
    'import type { ValidationResult } from "@/types/ai";',
    'import type { ValidationResult } from "@/types/ai";\nimport { PromptHandoffButton } from "@/components/PromptHandoffButton";',
    "ValidateProducts import",
  );

  next = replaceRequired(
    next,
    '            <Card className="bg-[#111111] border-primary/20">',
    `            <div className="flex justify-start">
              <PromptHandoffButton
                source="validate_product"
                title={productName.trim() || "Validação de produto"}
                summary={[
                  \`Produto: \${productName.trim() || "Não informado"}\`,
                  \`Público: \${targetMarket.trim() || "Não informado"}\`,
                  \`Diferenciais: \${activeResult.strengths?.slice(0, 3).join(", ") || description.trim() || "Não informados"}\`,
                  "Objetivo visual: destacar o posicionamento recomendado mantendo fidelidade ao produto.",
                ].join("\\n")}
                payload={{ productName, description, targetMarket, strengths: activeResult.strengths?.slice(0, 3), recommendation: activeResult.recommendation }}
                className="w-full sm:w-auto sm:max-w-[290px]"
              />
            </div>
            <Card className="bg-[#111111] border-primary/20">`,
    "ValidateProducts result card",
  );

  return next;
});

patchFile("src/pages/dashboard/CreateCampaign.tsx", (source) => {
  if (source.includes('from "@/components/PromptHandoffButton"')) return source;

  let next = replaceRequired(
    source,
    'import type { CampaignResult, CampaignPlatformField, CampaignCreativeBriefing } from "@/types/ai";',
    'import type { CampaignResult, CampaignPlatformField, CampaignCreativeBriefing } from "@/types/ai";\nimport { PromptHandoffButton } from "@/components/PromptHandoffButton";',
    "CreateCampaign import",
  );

  next = replaceRequired(
    next,
    '              <CardContent className="space-y-4">\n                {/* ── Campos por plataforma ── */}',
    `              <CardContent className="space-y-4">
                <div className="flex justify-start">
                  <PromptHandoffButton
                    source="create_campaign"
                    title={(campaignData._normalizedProduct ?? product).trim() || campaignData.headline || "Campanha"}
                    summary={[
                      \`Produto: \${(campaignData._normalizedProduct ?? product).trim() || campaignData.creativeBriefing?.produto || "Não informado"}\`,
                      \`Público: \${audience.trim() || campaignData.audience || "Não informado"}\`,
                      \`Promessa: \${campaignData.creativeBriefing?.promessa || campaignData.creativeBriefing?.beneficio || campaignData.headline || "Não informada"}\`,
                      \`Ideia visual: \${campaignData.creativeBriefing?.ideia_visual || "Criar uma imagem coerente com a campanha e fiel ao produto."}\`,
                    ].join("\\n")}
                    payload={{ product, audience, goal, mode, productType, creativeBriefing: campaignData.creativeBriefing, platform: campaignData.platform }}
                    className="w-full sm:w-auto sm:max-w-[290px]"
                  />
                </div>
                {/* ── Campos por plataforma ── */}`,
    "CreateCampaign result content",
  );

  return next;
});

patchFile("src/pages/dashboard/SavedPrompts.tsx", (source) => {
  if (source.includes("iattom_prompt_handoff_content_and_products_receiver_v1")) return source;

  const marker = "  useEffect(() => { void fetchPrompts(); }, []);";
  const replacement = `${marker}

  // iattom_prompt_handoff_content_and_products_receiver_v1
  useEffect(() => {
    try {
      const key = "iattom_prompt_handoff_v1";
      const raw = sessionStorage.getItem(key);
      if (!raw) return;

      const transfer = JSON.parse(raw) as {
        version?: number;
        source?: string;
        title?: string;
        summary?: string;
      };

      const acceptedSources = ["create_content", "find_products"];
      if (transfer.version !== 1 || !acceptedSources.includes(transfer.source ?? "") || !transfer.summary?.trim()) return;

      sessionStorage.removeItem(key);
      setCreating(true);
      setGuidedTipo("Imagem");
      setGuidedSubject(transfer.summary.trim());
      setGenerated(false);
      setNewTitle("");
      setNewPrompt("");
      toast({ description: transfer.source === "find_products" ? "Produto recebido. Revise e gere o prompt." : "Conteúdo recebido. Revise e gere o prompt." });
    } catch {
      sessionStorage.removeItem("iattom_prompt_handoff_v1");
      toast({ description: "Não foi possível carregar o conteúdo preparado.", variant: "destructive" });
    }
  }, [toast]);`;

  return replaceRequired(source, marker, replacement, "SavedPrompts content and products receiver");
});
