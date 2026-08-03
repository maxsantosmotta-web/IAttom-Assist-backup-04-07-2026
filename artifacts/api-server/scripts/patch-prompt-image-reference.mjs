import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const moduleMarker = '  imagem: "creative",\n  video: "video_script",';
const moduleBlock = '  imagem: "creative",\n  videocomimagem: "video_script",\n  video: "video_script",';
if (!source.includes('videocomimagem: "video_script"')) {
  if (!source.includes(moduleMarker)) throw new Error("Prompt module mapping marker not found");
  source = source.replace(moduleMarker, moduleBlock);
}

const contextMarker = '  imagem: "prompt para geração de imagem publicitária",\n  video: "prompt para geração de vídeo publicitário",';
const contextBlock = '  imagem: "prompt para geração de imagem publicitária",\n  videocomimagem: "prompt técnico para dar movimento a uma imagem pronta",\n  video: "prompt para geração de vídeo publicitário",';
if (!source.includes('videocomimagem: "prompt técnico para dar movimento a uma imagem pronta"')) {
  if (!source.includes(contextMarker)) throw new Error("Prompt context mapping marker not found");
  source = source.replace(contextMarker, contextBlock);
}

const videoRuleMarker = '  video: `\nPara VÍDEO, atue como diretor criativo, roteirista, diretor de fotografia e especialista em movimento.';
const imageMotionRule = `  videocomimagem: \`
Para VÍDEO COM IMAGEM, atue como especialista em image-to-video, direção de movimento e preservação visual.
Analise obrigatoriamente a imagem de referência enviada nesta solicitação antes de escrever.
Entregue somente um prompt técnico para dar movimento à imagem pronta. Não crie roteiro, narração, falas, personagens novos, sequência de cenas, divisão por tomadas, CTA ou estrutura de vídeo tradicional.
Identifique silenciosamente o assunto principal, cenário, enquadramento, profundidade, primeiro plano, fundo, iluminação, elementos que podem se mover naturalmente e elementos que devem permanecer fixos.
Escolha somente movimentos visualmente plausíveis e relevantes para a imagem. Priorize, nesta ordem: movimento principal, movimento de câmera, movimentos naturais do ambiente, preservação da composição e restrições contra deformações.
Defina movimentos coerentes de câmera e dos elementos visuais, usando profundidade, parallax, reflexos, luz, atmosfera e movimentos ambientais somente quando fizerem sentido para a imagem.
Preserve integralmente identidade, rosto, mãos, anatomia, produto, veículo, logotipo, textos, cores, materiais, proporções, composição e enquadramento. Não acrescente objetos, não remova elementos e não altere o design original.
Evite deformações, duplicações, derretimento, troca de identidade, mudança de texto, câmera agressiva, movimentos artificiais e efeitos exagerados.
O PROMPT final deve ser refinado, específico, completo e imediatamente executável, com no máximo 1.850 caracteres. Use inteligência para condensar sem perder qualidade. Termine todas as frases e nunca gere conteúdo excedente para redução posterior.\`,
`;
if (!source.includes("Para VÍDEO COM IMAGEM")) {
  if (!source.includes(videoRuleMarker)) throw new Error("Prompt video rule marker not found");
  source = source.replace(videoRuleMarker, imageMotionRule + videoRuleMarker);
}

const schemaMarker = `const GeneratePromptBody = z.object({
  tipo: z.string().min(1).max(50),
  subject: z.string().min(1).max(3000),
});`;
const schemaBlock = `const GeneratePromptBody = z.object({
  tipo: z.string().min(1).max(50),
  subject: z.string().max(3000).default(""),
  referenceImage: z.object({
    base64: z.string().min(1).max(12_000_000),
    mimeType: z.enum(["image/png", "image/jpeg"]),
  }).optional(),
});`;
if (!source.includes("referenceImage: z.object")) {
  if (!source.includes(schemaMarker)) throw new Error("Prompt generation schema marker not found");
  source = source.replace(schemaMarker, schemaBlock);
}

const parseMarker = `  const { tipo, subject: rawSubject } = parsed.data;
  const subject = semanticNormalize(rawSubject.trim());
  const tipoKey = tipo.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, "");`;
const parseBlock = `  const { tipo, subject: rawSubject, referenceImage } = parsed.data;
  const tipoKey = tipo.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, "");
  const subject = semanticNormalize(
    rawSubject.trim() || (tipoKey === "videocomimagem"
      ? "Analise a imagem de referência e crie o melhor prompt técnico para dar movimento a ela."
      : ""),
  );`;
if (!source.includes("rawSubject, referenceImage")) {
  if (!source.includes(parseMarker)) throw new Error("Prompt generation parse marker not found");
  source = source.replace(parseMarker, parseBlock);
}

const typeKeyMarker = '  const typeRules = TYPE_RULES[tipoKey] ?? TYPE_RULES.personalizado;';
const typeKeyBlock = `  const typeRules = TYPE_RULES[tipoKey] ?? TYPE_RULES.personalizado;

  if (tipoKey === "videocomimagem" && !referenceImage) {
    res.status(400).json({ error: "Selecione uma imagem de referência." });
    return;
  }

  if (tipoKey !== "videocomimagem" && !rawSubject.trim()) {
    res.status(400).json({ error: "Informe o assunto do prompt." });
    return;
  }`;
if (!source.includes('tipoKey === "videocomimagem" && !referenceImage')) {
  if (!source.includes(typeKeyMarker)) throw new Error("Prompt type validation marker not found");
  source = source.replace(typeKeyMarker, typeKeyBlock);
}

const generalRuleMarker = '- Use entre 140 e 420 palavras para Imagem ou Vídeo; entre 100 e 320 palavras para os demais tipos.';
const generalRuleBlock = '- Para Vídeo com Imagem, entregue um prompt completo, refinado e executável com no máximo 1.850 caracteres, sem segunda geração, resumo posterior ou corte. Para Imagem ou Vídeo, use entre 140 e 420 palavras; para os demais tipos, entre 100 e 320 palavras.';
if (!source.includes("no máximo 1.850 caracteres, sem segunda geração")) {
  if (!source.includes(generalRuleMarker)) throw new Error("Prompt general length rule marker not found");
  source = source.replace(generalRuleMarker, generalRuleBlock);
}

const messagesMarker = `      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: \`Tipo selecionado: \${tipo}\\nUse exclusivamente a solicitação atual descrita no sistema.\` },
      ],`;
const messagesBlock = `      messages: [
        { role: "system", content: systemMsg },
        {
          role: "user",
          content: referenceImage
            ? ([
                {
                  type: "text",
                  text: \`Tipo selecionado: \${tipo}\\nA imagem enviada é a referência obrigatória. Analise-a e gere diretamente uma única versão final, completa e refinada, com no máximo 1.850 caracteres. Selecione os movimentos mais plausíveis e impactantes sem perder fidelidade visual. Não gere texto excedente, não peça briefing adicional e não dependa de redução posterior.\`,
                },
                {
                  type: "image_url",
                  image_url: { url: \`data:\${referenceImage.mimeType};base64,\${referenceImage.base64}\` },
                },
              ] as any)
            : \`Tipo selecionado: \${tipo}\\nUse exclusivamente a solicitação atual descrita no sistema.\`,
        },
      ],`;
if (!source.includes("não dependa de redução posterior")) {
  if (!source.includes(messagesMarker)) throw new Error("Prompt OpenAI messages marker not found");
  source = source.replace(messagesMarker, messagesBlock);
}

const activityResponseMarker = `    const generatedTitle = titleMatch[1].trim().slice(0, 120);
    await logAiUsage({
      clerkUserId,
      action: \`Prompt criado: \${generatedTitle}\`,
      module: "prompts",
      projectName: generatedTitle,
    });

    res.json({
      title: generatedTitle,
      prompt: promptMatch[1].trim(),
      module,
    });`;

const responseBlock = `    let finalPrompt = promptMatch[1].trim();

    if (tipoKey === "videocomimagem") {
      finalPrompt = finalPrompt
        .normalize("NFC")
        .replace(/[\\u2018\\u2019]/g, "'")
        .replace(/[\\u201C\\u201D]/g, '"')
        .replace(/[\\u2013\\u2014]/g, "-")
        .replace(/\\u2026/g, "...")
        .replace(/\\u00A0/g, " ")
        .replace(/[\\u2022\\u25CF\\u25E6]/g, "-")
        .replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, "")
        .replace(/[ \\t]+\\n/g, "\\n")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();

      if (finalPrompt.length > 1850) {
        req.log.error({ promptLength: finalPrompt.length }, "prompts/generate: image-motion prompt exceeded 1,850 characters");
        res.status(500).json({ error: "Não foi possível finalizar o prompt dentro do limite com qualidade. Gere novamente." });
        return;
      }
    }

    const generatedTitle = titleMatch[1].trim().slice(0, 120);
    await logAiUsage({
      clerkUserId,
      action: \`Prompt criado: \${generatedTitle}\`,
      module: "prompts",
      projectName: generatedTitle,
    });

    res.json({
      title: generatedTitle,
      prompt: finalPrompt,
      module,
    });`;

if (!source.includes("let finalPrompt = promptMatch[1].trim();")) {
  if (!source.includes(activityResponseMarker)) throw new Error("Prompt activity response marker not found");
  source = source.replace(activityResponseMarker, responseBlock);
}

for (const marker of [
  'videocomimagem: "video_script"',
  "Para VÍDEO COM IMAGEM",
  "referenceImage: z.object",
  'tipoKey === "videocomimagem" && !referenceImage',
  "não dependa de redução posterior",
  "let finalPrompt = promptMatch[1].trim();",
  'module: "prompts"',
  "finalPrompt.length > 1850",
  '.normalize("NFC")',
]) {
  if (!source.includes(marker)) throw new Error(`Prompt image-aware backend marker missing: ${marker}`);
}

if (source.includes("const compacted = await openai.chat.completions.create")) {
  throw new Error("Prompt image-aware backend still contains the forbidden second AI reduction call");
}
if (source.includes("finalPrompt.slice(0,")) {
  throw new Error("Prompt image-aware backend still contains forbidden prompt truncation");
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now generates one refined prompt up to 1,850 characters, normalizes compatible text, and never calls AI again to reduce it.");
