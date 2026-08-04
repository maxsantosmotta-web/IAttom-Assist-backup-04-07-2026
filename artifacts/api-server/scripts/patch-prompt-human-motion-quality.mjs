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

const aggressiveRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
Quando houver uma pessoa claramente visível, aplique obrigatoriamente DIREÇÃO HUMANA NATURAL. Analise rosto, direção do olhar, expressão, possibilidade de sorriso, olhos, mãos, dedos, braços, tronco, postura e interação com o cenário. Escolha uma ação humana principal claramente perceptível entre o início e o final dos 6 segundos e complemente com no máximo duas ações secundárias naturais. Quando a pose permitir, priorize ações como virar o rosto, encontrar a câmera com o olhar, ampliar suavemente um sorriso, piscar, ajustar as mãos, mover os dedos, reposicionar um braço ou inclinar levemente o tronco. Respiração, piscada isolada e micro movimento não podem ser a ação principal quando a imagem permite uma mudança humana mais expressiva.
Descreva o movimento como direção visual clara, natural e cinematográfica. Não transforme o prompt em especificação de engenharia. Evite graus exatos, centímetros, pixels, porcentagens faciais, contagem de quadros, timestamps excessivos, depth-map, optical-flow, warping, temporal anti-aliasing ou nomes de técnicas internas, salvo quando forem indispensáveis. Prefira sequência simples: estado inicial, evolução natural da ação, pose final e movimento suave de câmera.
Para cenas com pessoa, câmera e ambiente apenas valorizam a ação humana. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo. Esses efeitos só podem aparecer quando já estiverem claramente presentes na imagem e forem essenciais à cena.
Quando não houver pessoa, analise produto, objeto ou ambiente com liberdade criativa e técnica: identifique partes móveis, materiais, profundidade, contexto de uso, interação plausível e melhor movimento de câmera, sem fórmulas repetidas e sem efeitos gratuitos.
Em qualquer categoria, preserve identidade, anatomia, textos, logotipos, materiais, proporções e composição. O resultado deve ser visualmente claro, executável, natural e premium, sem excesso de jargão técnico.`;

const refinedRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
A prioridade absoluta é preservar a fotografia original. O primeiro instante do vídeo deve corresponder exatamente à imagem enviada, sem salto inicial, reposicionamento, transformação, duplicação de contorno, deslocamento fantasma ou reconstrução súbita de rosto, corpo, produto ou cenário.
Quando houver uma pessoa, aplique DIREÇÃO HUMANA CONSERVADORA E NATURAL. Antes de sugerir qualquer ação, verifique se rosto, olhos, boca, mãos, dedos, braços, tronco e pernas estão suficientemente visíveis, definidos e livres para o movimento. Partes cortadas pelo enquadramento, ocultas, desfocadas, encobertas por objetos, segurando produtos ou sem informação visual suficiente devem permanecer estáticas.
Movimento humano só é permitido quando a pose original sustentar claramente a transição. Se houver risco de deformação, aceite respiração sutil, piscada natural, pequena mudança de expressão ou micro movimento de cabeça como ação principal. Nunca force virar o rosto, criar contato visual, ampliar sorriso, mover dedos, reposicionar braços ou inclinar o tronco quando a posição original não oferecer base visual segura.
Use no máximo uma ação humana principal e uma ação secundária discreta. Preserve identidade, anatomia, direção do olhar, expressão, proporções e contato com objetos. Não invente partes fora do enquadramento, não complete membros ocultos e não altere a forma de mãos, dedos, braços ou rosto.
Produto, embalagem, texto, logotipo, veículo, acessório e qualquer elemento comercial têm prioridade de preservação. Se a pessoa estiver segurando ou interagindo com um produto, mantenha produto e pontos de contato estáveis, sem escorregar, deformar, duplicar ou mudar de posição.
Quando o movimento humano não for seguro, valorize a cena com câmera discreta, profundidade, parallax suave, luz existente e movimento ambiental já sugerido pela fotografia. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo, salvo quando esses elementos já estiverem claramente presentes.
Para produto, objeto ou ambiente, identifique somente partes realmente móveis e interações fisicamente plausíveis. Elementos rígidos, textos, logotipos, superfícies, formas e proporções devem permanecer estáveis.
Descreva o movimento como direção visual clara, curta e executável, sem graus exatos, centímetros, pixels, porcentagens faciais, timestamps excessivos ou jargões técnicos. O resultado deve ser natural, contínuo e premium, sem deformações, derretimento, duplicações, movimentos forçados ou alterações incompatíveis com a imagem.`;

if (source.includes(aggressiveRule)) {
  source = source.replace(aggressiveRule, refinedRule);
} else if (source.includes(previousRule)) {
  source = source.replace(previousRule, refinedRule);
} else if (source.includes(originalRule)) {
  source = source.replace(originalRule, refinedRule);
}

const originalUserInstruction = "Selecione os movimentos mais plausíveis e impactantes sem perder fidelidade visual.";
const previousUserInstruction = "Classifique a cena antes de escrever. Se houver pessoa, obrigue uma ação humana principal perceptível e explore rosto, olhar, expressão, mãos e postura antes de câmera ou ambiente. Se não houver pessoa, escolha com inteligência os movimentos próprios do produto, objeto ou cenário. Não use efeitos genéricos para preencher o vídeo.";
const aggressiveUserInstruction = "Classifique a cena antes de escrever. Se houver pessoa, crie uma direção humana natural com uma ação principal perceptível e até duas ações secundárias, explorando rosto, olhar, expressão, mãos e postura antes de câmera ou ambiente. Escreva como direção visual premium, sem excesso de números, timestamps ou jargões técnicos. Se não houver pessoa, escolha com inteligência os movimentos próprios do produto, objeto ou cenário. Não use efeitos genéricos para preencher o vídeo.";
const refinedUserInstruction = "Classifique a cena antes de escrever e preserve a fotografia original no primeiro instante. Só mova pessoas, rosto, mãos, braços ou objetos quando a pose e a visibilidade oferecerem base segura. Mantenha estáticos elementos cortados, ocultos, desfocados, segurando produtos ou sem definição suficiente. Quando houver risco, aceite micro movimento natural e use câmera discreta, profundidade ou ambiente. Preserve produto, textos, logotipos, anatomia, pontos de contato, formas e proporções. Não force ações nem crie movimento fantasma no início.";

if (source.includes(aggressiveUserInstruction)) {
  source = source.replace(aggressiveUserInstruction, refinedUserInstruction);
} else if (source.includes(previousUserInstruction)) {
  source = source.replace(previousUserInstruction, refinedUserInstruction);
} else if (source.includes(originalUserInstruction)) {
  source = source.replace(originalUserInstruction, refinedUserInstruction);
}

for (const marker of [
  "DIREÇÃO HUMANA CONSERVADORA E NATURAL",
  "O primeiro instante do vídeo deve corresponder exatamente à imagem enviada",
  "Partes cortadas pelo enquadramento, ocultas, desfocadas",
  "Movimento humano só é permitido quando a pose original sustentar claramente a transição",
  "aceite respiração sutil, piscada natural",
  "Produto, embalagem, texto, logotipo",
  "mantenha produto e pontos de contato estáveis",
  "Não force ações nem crie movimento fantasma no início",
]) {
  if (!source.includes(marker)) throw new Error(`Human-motion safety marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now prioritizes first-frame fidelity and conservative natural movement.");
