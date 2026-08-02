import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const oldRule = `Escolha somente movimentos visualmente plausíveis e relevantes para a imagem. Priorize, nesta ordem: movimento principal, movimento de câmera, movimentos naturais do ambiente, preservação da composição e restrições contra deformações.
Defina movimentos coerentes de câmera e dos elementos visuais, usando profundidade, parallax, reflexos, luz, atmosfera e movimentos ambientais somente quando fizerem sentido para a imagem.`;

const newRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
Quando houver uma pessoa claramente visível, aplique obrigatoriamente DIREÇÃO HUMANA: analise direção do rosto e do olhar, expressão, olhos, sorriso possível, mãos, dedos, braços, tronco, postura e interação com o cenário. Escolha uma ação humana principal perceptível entre o início e o final dos 6 segundos e complemente com movimentos naturais secundários. Quando a pose permitir, priorize ações como virar o rosto, buscar contato visual com a câmera, piscar, esboçar um sorriso, ajustar as mãos, mover os dedos, reposicionar braços ou inclinar suavemente o tronco. Pequena respiração, piscada isolada ou micro movimento de cabeça não bastam como ação principal quando a imagem permite algo mais expressivo.
Para cenas com pessoa, câmera e ambiente só podem valorizar a ação humana. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo. Esses efeitos só podem aparecer quando já estiverem claramente presentes na imagem e forem essenciais à cena.
Quando não houver pessoa, analise produto, objeto ou ambiente com liberdade técnica: identifique partes móveis, materiais, profundidade, contexto de uso, interação plausível, melhor movimento de câmera e efeitos realmente coerentes, sem aplicar fórmulas repetidas.
Em qualquer categoria, escolha somente movimentos plausíveis e relevantes, preserve a composição e inclua restrições contra deformações.`;

if (source.includes(oldRule)) {
  source = source.replace(oldRule, newRule);
}

const oldUserInstruction = "Selecione os movimentos mais plausíveis e impactantes sem perder fidelidade visual.";
const newUserInstruction = "Classifique a cena antes de escrever. Se houver pessoa, obrigue uma ação humana principal perceptível e explore rosto, olhar, expressão, mãos e postura antes de câmera ou ambiente. Se não houver pessoa, escolha com inteligência os movimentos próprios do produto, objeto ou cenário. Não use efeitos genéricos para preencher o vídeo.";
if (source.includes(oldUserInstruction)) {
  source = source.replace(oldUserInstruction, newUserInstruction);
}

for (const marker of [
  "aplique obrigatoriamente DIREÇÃO HUMANA",
  "ação humana principal perceptível",
  "Não use fumaça, névoa, poeira, partículas",
  "Quando não houver pessoa",
  "Classifique a cena antes de escrever",
]) {
  if (!source.includes(marker)) throw new Error(`Human-motion quality marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now prioritizes expressive human motion and blocks generic filler effects for people scenes.");
