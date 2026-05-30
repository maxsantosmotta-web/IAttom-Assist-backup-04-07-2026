import { openai } from "@workspace/integrations-openai-ai-server";

export interface ReferenceAnalysisResult {
  productDetected: string;
  confidence: "high" | "medium" | "low";
  compatible: boolean;
  reason: string;
}

export async function analyzeReference(
  imageBase64: string,
  productName: string
): Promise<ReferenceAnalysisResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content:
          'You are a product image classifier. Identify the main product in the image and compare it to the given campaign product. Respond ONLY with valid JSON: { "productDetected": string, "confidence": "high"|"medium"|"low", "compatible": boolean, "reason": string }. Set compatible=true only if the image clearly shows the same product type and category as the campaign product.',
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
          {
            type: "text",
            text: `Campaign product: "${productName}"\n\nWhat is the main product shown in this image? Is it the same type/category as "${productName}"?`,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<ReferenceAnalysisResult>;
    const confidence = (["high", "medium", "low"] as const).includes(
      parsed.confidence as "high" | "medium" | "low"
    )
      ? (parsed.confidence as "high" | "medium" | "low")
      : "low";
    return {
      productDetected: parsed.productDetected ?? "produto desconhecido",
      confidence,
      compatible: parsed.compatible ?? false,
      reason: parsed.reason ?? "",
    };
  } catch {
    return {
      productDetected: "produto desconhecido",
      confidence: "low",
      compatible: false,
      reason: "Não foi possível analisar a imagem.",
    };
  }
}
