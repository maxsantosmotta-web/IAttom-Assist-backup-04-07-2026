import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const originalRule = `Escolha somente movimentos visualmente plausíveis e relevantes para a imagem. Priorize, nesta ordem: movimento principal, movimento de câmera, movimentos naturais do ambiente, preservação da composição e restrições contra deformações.
Defina movimentos coerentes de câmera e dos elementos visuais, usando profundidade, parallax, reflexos, luz, atmosfera e movimentos ambientais somente quando fizerem sentido para a imagem.`;

const previousRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
Quando houver uma pessoa claramente visível, aplique obrigatoriamente DIREÇÃO HUMANA: analise direção do rosto e do olhar, expressão, olhos, sorriso possível, mãos, dedos, braços, tronco, postura e interação com o cenário. Escolha uma ação humana principal perceptível entre o início e o final dos 6 segundos e complemente com movimentos naturais secundários. Quando a pose permitir, priorize ações como virar o rosto, buscar contato visual com a câmera, piscar, esboçar um sorriso, ajustar as mãos, mover os dedos, reposicionar braços ou inclinar suavemente o tronco. Pequena respiração, piscada isolada ou micro movimento de cabeça não bastam como ação principal quando a imagem permite algo mais expressivo.
Para cenas com pessoa, câmera e ambiente só podem valorizar a ação humana. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo. Esses efeitos só podem aparecer quando já estiverem claramente presentes na imagem e forem essenciais à cena.
Quando não houver pessoa, analise produto, objeto ou ambiente com liberdade técnica: identifique partes móveis, materiais, profundidade, contexto de uso, interação plausível, melhor movimento de câmera e efeitos realmente coerentes, sem aplicar fórmulas repetidas.
Em qualquer categoria, escolha somente movimentos plausíveis e relevantes, preserve a composição e inclua restrições contra deformações.`;

const refinedRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
Quando houver uma pessoa claramente visível, aplique obrigatoriamente DIREÇÃO HUMANA NATURAL. Analise rosto, direção do olhar, expressão, possibilidade de sorriso, olhos, mãos, dedos, braços, tronco, postura e interação com o cenário. Escolha uma ação humana principal claramente perceptível entre o início e o final dos 6 segundos e complemente com no máximo duas ações secundárias naturais. Quando a pose permitir, priorize ações como virar o rosto, encontrar a câmera com o olhar, ampliar suavemente um sorriso, piscar, ajustar as mãos, mover os dedos, reposicionar um braço ou inclinar levemente o tronco. Respiração, piscada isolada e micro movimento não podem ser a ação principal quando a imagem permite uma mudança humana mais expressiva.
Descreva o movimento como direção visual clara, natural e cinematográfica. Não transforme o prompt em especificação de engenharia. Evite graus exatos, centímetros, pixels, porcentagens faciais, contagem de quadros, timestamps excessivos, depth-map, optical-flow, warping, temporal anti-aliasing ou nomes de técnicas internas, salvo quando forem indispensáveis. Prefira sequência simples: estado inicial, evolução natural da ação, pose final e movimento suave de câmera.
Para cenas com pessoa, câmera e ambiente apenas valorizam a ação humana. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo. Esses efeitos só podem aparecer quando já estiverem claramente presentes na imagem e forem essenciais à cena.
Quando não houver pessoa, analise produto, objeto ou ambiente com liberdade criativa e técnica: identifique partes móveis, materiais, profundidade, contexto de uso, interação plausível e melhor movimento de câmera, sem fórmulas repetidas e sem efeitos gratuitos.
Em qualquer categoria, preserve identidade, anatomia, textos, logotipos, materiais, proporções e composição. O resultado deve ser visualmente claro, executável, natural e premium, sem excesso de jargão técnico.`;

if (source.includes(originalRule)) {
  source = source.replace(originalRule, refinedRule);
} else if (source.includes(previousRule)) {
  source = source.replace(previousRule, refinedRule);
}

const originalUserInstruction = "Selecione os movimentos mais plausíveis e impactantes sem perder fidelidade visual.";
const previousUserInstruction = "Classifique a cena antes de escrever. Se houver pessoa, obrigue uma ação humana principal perceptível e explore rosto, olhar, expressão, mãos e postura antes de câmera ou ambiente. Se não houver pessoa, escolha com inteligência os movimentos próprios do produto, objeto ou cenário. Não use efeitos genéricos para preencher o vídeo.";
const refinedUserInstruction = "Classifique a cena antes de escrever. Se houver pessoa, crie uma direção humana natural com uma ação principal perceptível e até duas ações secundárias, explorando rosto, olhar, expressão, mãos e postura antes de câmera ou ambiente. Escreva como direção visual premium, sem excesso de números, timestamps ou jargões técnicos. Se não houver pessoa, escolha com inteligência os movimentos próprios do produto, objeto ou cenário. Não use efeitos genéricos para preencher o vídeo.";

if (source.includes(originalUserInstruction)) {
  source = source.replace(originalUserInstruction, refinedUserInstruction);
} else if (source.includes(previousUserInstruction)) {
  source = source.replace(previousUserInstruction, refinedUserInstruction);
}

for (const marker of [
  "DIREÇÃO HUMANA NATURAL",
  "ação humana principal claramente perceptível",
  "no máximo duas ações secundárias naturais",
  "Não transforme o prompt em especificação de engenharia",
  "Evite graus exatos, centímetros, pixels",
  "Não use fumaça, névoa, poeira, partículas",
  "sem excesso de jargão técnico",
]) {
  if (!source.includes(marker)) throw new Error(`Human-motion refinement marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now produces natural premium human direction without engineering-style prompt clutter.");
