import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const conservativeRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
A prioridade absoluta é preservar a fotografia original. O primeiro instante do vídeo deve corresponder exatamente à imagem enviada, sem salto inicial, reposicionamento, transformação, duplicação de contorno, deslocamento fantasma ou reconstrução súbita de rosto, corpo, produto ou cenário.
Quando houver uma pessoa, aplique DIREÇÃO HUMANA CONSERVADORA E NATURAL. Antes de sugerir qualquer ação, verifique se rosto, olhos, boca, mãos, dedos, braços, tronco e pernas estão suficientemente visíveis, definidos e livres para o movimento. Partes cortadas pelo enquadramento, ocultas, desfocadas, encobertas por objetos, segurando produtos ou sem informação visual suficiente devem permanecer estáticas.
Movimento humano só é permitido quando a pose original sustentar claramente a transição. Se houver risco de deformação, aceite respiração sutil, piscada natural, pequena mudança de expressão ou micro movimento de cabeça como ação principal. Nunca force virar o rosto, criar contato visual, ampliar sorriso, mover dedos, reposicionar braços ou inclinar o tronco quando a posição original não oferecer base visual segura.
Use no máximo uma ação humana principal e uma ação secundária discreta. Preserve identidade, anatomia, direção do olhar, expressão, proporções e contato com objetos. Não invente partes fora do enquadramento, não complete membros ocultos e não altere a forma de mãos, dedos, braços ou rosto.
Produto, embalagem, texto, logotipo, veículo, acessório e qualquer elemento comercial têm prioridade de preservação. Se a pessoa estiver segurando ou interagindo com um produto, mantenha produto e pontos de contato estáveis, sem escorregar, deformar, duplicar ou mudar de posição.
Quando o movimento humano não for seguro, valorize a cena com câmera discreta, profundidade, parallax suave, luz existente e movimento ambiental já sugerido pela fotografia. Não use fumaça, névoa, poeira, partículas, flare, shimmer, brilho especular animado ou reflexos artificiais para preencher o vídeo, salvo quando esses elementos já estiverem claramente presentes.
Para produto, objeto ou ambiente, identifique somente partes realmente móveis e interações fisicamente plausíveis. Elementos rígidos, textos, logotipos, superfícies, formas e proporções devem permanecer estáveis.
Descreva o movimento como direção visual clara, curta e executável, sem graus exatos, centímetros, pixels, porcentagens faciais, timestamps excessivos ou jargões técnicos. O resultado deve ser natural, contínuo e premium, sem deformações, derretimento, duplicações, movimentos forçados ou alterações incompatíveis com a imagem.`;

const dynamicRule = `Classifique silenciosamente a cena antes de escrever: pessoa, produto, objeto ou ambiente.
A prioridade absoluta é preservar a fotografia original. O primeiro instante do vídeo deve corresponder exatamente à imagem enviada, sem salto inicial, reposicionamento, transformação, duplicação de contorno, deslocamento fantasma ou reconstrução súbita de rosto, corpo, produto ou cenário.
Quando houver uma pessoa, faça uma ANÁLISE DINÂMICA DE VIABILIDADE antes de escolher a ação. Observe pose, articulações, mãos, dedos, braços, pernas, rosto, enquadramento, objetos, pontos de contato e partes ocultas. Classifique internamente cada movimento como seguro, moderado ou inviável para aquela imagem específica.
Movimentos seguros podem ser executados naturalmente. Movimentos moderados são permitidos quando a estrutura corporal necessária está visível ou pode ser acompanhada de forma contínua: use amplitude curta, velocidade controlada, uma única transição clara e pose final simples. Braços cruzados com ombros, cotovelos, antebraços e mãos suficientemente identificáveis podem ser descruzados de forma gradual; mãos parcialmente visíveis podem acompanhar um gesto curto; uma perna e um objeto em contato podem realizar apenas uma ação simples quando ambos estiverem bem definidos.
Não trate qualquer sobreposição natural como proibição automática. Diferencie parte parcialmente encoberta, mas identificável, de parte realmente ausente. Só evite ou adapte movimentos que exigiriam inventar anatomia totalmente oculta, completar partes fora do enquadramento, reconstruir mãos escondidas em bolsos, criar membros inexistentes ou romper contato físico sem informação visual suficiente.
Escolha a ação principal mais expressiva que a imagem realmente suporta, sem recorrer automaticamente a piscada, respiração ou zoom. Use micro movimento apenas quando nenhuma transição corporal mais perceptível for tecnicamente sustentável. A decisão deve nascer da imagem atual e não de uma lista fixa de ações.
Use no máximo uma ação humana principal e uma ação secundária discreta. Descreva estado inicial, transição contínua e pose final. Preserve identidade, anatomia, direção do olhar, expressão, roupa, proporções e coerência de ombros, cotovelos, punhos, mãos, dedos, quadris, joelhos e pés. Inclua restrições específicas contra duplicação, mãos fantasmas, membros extras, derretimento e troca súbita de pose somente nos pontos realmente envolvidos no movimento.
Produto, embalagem, texto, logotipo, veículo, acessório e qualquer elemento comercial têm prioridade de preservação. Quando houver interação com produto ou objeto, avalie se o contato pode permanecer estável durante a ação; reduza a amplitude ou mantenha o objeto fixo quando necessário, sem deformar, duplicar, escorregar ou alterar textos e logotipos.
Quando a ação solicitada ou sugerida for inviável, adapte-a para a alternativa mais próxima e visualmente útil que a imagem sustente, em vez de forçar o movimento ou reduzir tudo a uma imagem praticamente parada. Câmera discreta, profundidade, parallax suave, luz existente e movimento ambiental só devem complementar a ação e nunca mascarar incapacidade de animar o elemento principal.
Para produto, objeto ou ambiente, analise partes móveis, materiais, articulações, apoio, gravidade, profundidade e contexto de uso. Permita movimento apenas quando fisicamente plausível e preserve elementos rígidos, textos, logotipos, superfícies, formas e proporções.
Descreva o movimento como direção visual clara, curta e executável, sem graus exatos, centímetros, pixels, porcentagens faciais, timestamps excessivos ou jargões técnicos. O resultado deve ser natural, contínuo, perceptível e premium, sem fórmulas repetidas e sem usar o mesmo comportamento para imagens diferentes.`;

const conservativeUserInstruction = "Classifique a cena antes de escrever e preserve a fotografia original no primeiro instante. Só mova pessoas, rosto, mãos, braços ou objetos quando a pose e a visibilidade oferecerem base segura. Mantenha estáticos elementos cortados, ocultos, desfocados, segurando produtos ou sem definição suficiente. Quando houver risco, aceite micro movimento natural e use câmera discreta, profundidade ou ambiente. Preserve produto, textos, logotipos, anatomia, pontos de contato, formas e proporções. Não force ações nem crie movimento fantasma no início.";

const dynamicUserInstruction = "Analise a imagem atual e determine dinamicamente o movimento mais expressivo que ela sustenta. Diferencie movimento seguro, moderado e inviável. Não bloqueie automaticamente braços cruzados ou partes parcialmente sobrepostas quando articulações e mãos ainda forem identificáveis; nesses casos, use transição curta, contínua e controlada. Só evite ações que exijam inventar anatomia ausente, partes fora do quadro ou mãos totalmente escondidas. Preserve o primeiro quadro, identidade, anatomia, produtos, textos, logotipos e pontos de contato. Adapte movimentos inviáveis para a alternativa útil mais próxima, sem recorrer sempre a piscada, respiração, zoom ou efeitos genéricos.";

if (!source.includes(conservativeRule)) {
  if (source.includes(dynamicRule)) {
    console.log("Dynamic image-motion feasibility analysis already installed.");
  } else {
    throw new Error("Conservative human-motion rule not found in final prompts source");
  }
} else {
  source = source.replace(conservativeRule, dynamicRule);
}

if (source.includes(conservativeUserInstruction)) {
  source = source.replace(conservativeUserInstruction, dynamicUserInstruction);
} else if (!source.includes(dynamicUserInstruction)) {
  throw new Error("Conservative image-motion user instruction not found");
}

for (const marker of [
  "ANÁLISE DINÂMICA DE VIABILIDADE",
  "Classifique internamente cada movimento como seguro, moderado ou inviável",
  "Braços cruzados com ombros, cotovelos, antebraços e mãos suficientemente identificáveis podem ser descruzados",
  "reconstruir mãos escondidas em bolsos",
  "A decisão deve nascer da imagem atual e não de uma lista fixa de ações",
  "adapte-a para a alternativa mais próxima e visualmente útil",
  "sem usar o mesmo comportamento para imagens diferentes",
]) {
  if (!source.includes(marker)) throw new Error(`Dynamic motion feasibility marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Vídeo com Imagem now analyzes movement feasibility dynamically for each source image.");
