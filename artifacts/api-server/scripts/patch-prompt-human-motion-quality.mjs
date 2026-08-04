import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/routes/prompts.ts", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const originalRule = `Escolha somente movimentos visualmente plausíveis e relevantes para a imagem. Priorize, nesta ordem: movimento principal, movimento de câmera, movimentos naturais do ambiente, preservação da composição e restrições contra deformações.
Defina movimentos coerentes de câmera e dos elementos visuais, usando profundidade, parallax, reflexos, luz, atmosfera e movimentos ambientais somente quando fizerem sentido para a imagem.
Preserve integralmente identidade, rosto, mãos, anatomia, produto, veículo, logotipo, textos, cores, materiais, proporções, composição e enquadramento. Não acrescente objetos, não remova elementos e não altere o design original.
Evite deformações, duplicações, derretimento, troca de identidade, mudança de texto, câmera agressiva, movimentos artificiais e efeitos exagerados.`;

const conservativeRule = `A prioridade absoluta é preservar a fotografia original. O primeiro instante do vídeo deve corresponder exatamente à imagem enviada, sem salto inicial, reposicionamento, transformação, duplicação de contorno, deslocamento fantasma ou reconstrução súbita de rosto, corpo, produto ou cenário.
Quando houver uma pessoa, aplique DIREÇÃO HUMANA CONSERVADORA E NATURAL. Antes de sugerir qualquer ação, verifique se rosto, olhos, boca, mãos, dedos, braços, tronco e pernas estão suficientemente visíveis, definidos e livres para o movimento. Partes cortadas pelo enquadramento, ocultas, desfocadas, encobertas por objetos, segurando produtos ou sem informação visual suficiente devem permanecer estáticas.
Movimento humano só é permitido quando a pose original sustentar claramente a transição. Se houver risco de deformação, aceite respiração sutil, piscada natural, pequena mudança de expressão ou micro movimento de cabeça como ação principal. Nunca force virar o rosto, criar contato visual, ampliar sorriso, mover dedos, reposicionar braços ou inclinar o tronco quando a posição original não oferecer base visual segura.`;

const dynamicRule = `A prioridade absoluta é preservar a fotografia original. O primeiro instante do vídeo deve corresponder exatamente à imagem enviada, sem salto inicial, reposicionamento, transformação, duplicação de contorno, deslocamento fantasma ou reconstrução súbita de rosto, corpo, produto ou cenário.
Quando houver uma pessoa, faça uma ANÁLISE DINÂMICA DE VIABILIDADE antes de escolher a ação. Observe pose, articulações, mãos, dedos, braços, pernas, rosto, enquadramento, objetos, pontos de contato e partes ocultas. Classifique internamente cada movimento como seguro, moderado ou inviável para aquela imagem específica.
Movimentos seguros podem ser executados naturalmente. Movimentos moderados são permitidos quando a estrutura corporal necessária está visível ou pode ser acompanhada continuamente: use amplitude curta, velocidade controlada, uma única transição clara e pose final simples. Braços cruzados com ombros, cotovelos, antebraços e mãos suficientemente identificáveis podem ser descruzados gradualmente; mãos parcialmente visíveis podem acompanhar gesto curto; perna e objeto em contato podem realizar apenas uma ação simples quando ambos estiverem bem definidos.
Não trate qualquer sobreposição natural como proibição automática. Diferencie parte parcialmente encoberta, mas identificável, de parte realmente ausente. Só evite ou adapte movimentos que exigiriam inventar anatomia totalmente oculta, completar partes fora do enquadramento, reconstruir mãos escondidas em bolsos, criar membros inexistentes ou romper contato físico sem informação visual suficiente.
Escolha a ação principal mais expressiva que a imagem realmente suporta, sem recorrer automaticamente a piscada, respiração ou zoom. Use micro movimento apenas quando nenhuma transição corporal mais perceptível for tecnicamente sustentável. A decisão deve nascer da imagem atual e não de uma lista fixa de ações.
Use no máximo uma ação humana principal e uma ação secundária discreta. Descreva estado inicial, transição contínua e pose final. Preserve identidade, anatomia, direção do olhar, expressão, roupa, proporções e coerência de ombros, cotovelos, punhos, mãos, dedos, quadris, joelhos e pés. Inclua restrições específicas contra duplicação, mãos fantasmas, membros extras, derretimento e troca súbita de pose somente nos pontos realmente envolvidos no movimento.
Produto, embalagem, texto, logotipo, veículo, acessório e qualquer elemento comercial têm prioridade de preservação. Quando houver interação com produto ou objeto, avalie se o contato pode permanecer estável durante a ação; reduza a amplitude ou mantenha o objeto fixo quando necessário, sem deformar, duplicar, escorregar ou alterar textos e logotipos.
Quando a ação for inviável, adapte-a para a alternativa mais próxima e visualmente útil que a imagem sustente, em vez de forçar o movimento ou reduzir tudo a uma imagem praticamente parada. Câmera discreta, profundidade, parallax suave, luz existente e movimento ambiental só devem complementar a ação e nunca mascarar incapacidade de animar o elemento principal.
Para produto, objeto ou ambiente, analise partes móveis, materiais, articulações, apoio, gravidade, profundidade e contexto de uso. Permita movimento apenas quando fisicamente plausível e preserve elementos rígidos, textos, logotipos, superfícies, formas e proporções.
Descreva o movimento como direção visual clara, curta e executável, sem graus exatos, centímetros, pixels, porcentagens faciais, timestamps excessivos ou jargões técnicos. O resultado deve ser natural, contínuo, perceptível e premium, sem fórmulas repetidas e sem usar o mesmo comportamento para imagens diferentes.`;

if (!source.includes("ANÁLISE DINÂMICA DE VIABILIDADE")) {
  if (source.includes(originalRule)) {
    source = source.replace(originalRule, dynamicRule);
  } else if (source.includes(conservativeRule)) {
    source = source.replace(conservativeRule, dynamicRule);
  } else {
    throw new Error("Image-motion rule present in build does not match any supported source state");
  }
}

const originalInstruction = "Selecione os movimentos mais plausíveis e impactantes sem perder fidelidade visual.";
const dynamicInstruction = "Analise a imagem atual e determine dinamicamente o movimento mais expressivo que ela sustenta. Diferencie movimento seguro, moderado e inviável. Não bloqueie automaticamente braços cruzados ou partes parcialmente sobrepostas quando articulações e mãos ainda forem identificáveis. Só evite ações que exijam inventar anatomia ausente, partes fora do quadro ou mãos totalmente escondidas. Preserve o primeiro quadro, identidade, anatomia, produtos, textos, logotipos e pontos de contato. Adapte movimentos inviáveis para a alternativa útil mais próxima, sem recorrer sempre a piscada, respiração, zoom ou efeitos genéricos.";

if (source.includes(originalInstruction)) {
  source = source.replace(originalInstruction, dynamicInstruction);
} else if (!source.includes(dynamicInstruction)) {
  throw new Error("Image-motion user instruction present in build was not recognized");
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

const creativeFileUrl = new URL("../src/lib/ai/creativeIdeas.ts", import.meta.url);
let creativeSource = readFileSync(creativeFileUrl, "utf8");

const originalFidelityRule = "REGRA ABSOLUTA DE FIDELIDADE AO PRODUTO: O produto informado é a referência central e obrigatória. NÃO substitua por versão genérica ou produto parecido. Preserve o nome exato, aparência, proporções e categoria do produto.";
const dynamicHierarchyRule = `REGRA ABSOLUTA DE FIDELIDADE E HIERARQUIA VISUAL: Antes de escrever cada imagePrompt, faça uma ANÁLISE DINÂMICA DO FOCO COMERCIAL desta solicitação específica. Identifique assunto principal, produto ou serviço promovido, pessoa, cenário, elementos de apoio e objetivo da peça. Defina internamente uma hierarquia visual clara para cada conceito.
Quando o objetivo comercial for vender, apresentar, comparar ou destacar um produto físico, o produto deve ser o protagonista inequívoco da composição: maior peso visual, melhor iluminação, nitidez prioritária, posição dominante e leitura imediata. Pessoas podem demonstrar uso, escala, benefício ou contexto, mas não podem ocupar mais atenção, área útil, contraste ou destaque que o produto, salvo quando o próprio pedido declarar explicitamente que a pessoa é o assunto principal.
Quando o pedido for serviço, marca pessoal, perfil profissional, campanha institucional ou emoção humana, determine dinamicamente se a pessoa, ambiente, símbolo ou benefício deve liderar. Não aplique a regra de produto dominante onde não houver produto físico central.
Diferencie protagonista, elemento secundário e cenário em cada imagem. Não use automaticamente pessoa em primeiro plano, rosto grande, modelo central ou pose de influenciador apenas por haver alguém na cena. Não reduza o produto a acessório, objeto pequeno, item na mão, fundo desfocado ou detalhe lateral quando ele for o foco comercial.
Preserve o nome exato, aparência, proporções, categoria, materiais, cores e características informadas. Não substitua por versão genérica ou produto parecido. A decisão deve nascer do pedido atual e não de uma fórmula fixa.`;

if (!creativeSource.includes("ANÁLISE DINÂMICA DO FOCO COMERCIAL")) {
  if (!creativeSource.includes(originalFidelityRule)) {
    throw new Error("Creative image fidelity rule not found in final generator source");
  }
  creativeSource = creativeSource.replace(originalFidelityRule, dynamicHierarchyRule);
}

const originalUserImageInstruction = `INSTRUÇÃO: O imagePrompt de cada conceito deve iniciar com "${'${productName}'}". Aplique as diretrizes do especialista, preserve o briefing profissional quando fornecido e adapte a composição ao enquadramento de cada formato.`;
const dynamicUserImageInstruction = `INSTRUÇÃO: O imagePrompt de cada conceito deve iniciar com "${'${productName}'}". Antes de definir composição, determine dinamicamente o protagonista visual real desta solicitação. Quando houver produto físico com objetivo comercial, descreva-o como foco dominante e use pessoas apenas como apoio funcional, sem roubar área, contraste, nitidez ou protagonismo. Quando o pedido tiver outro foco, respeite a hierarquia apropriada à intenção. Aplique as diretrizes do especialista, preserve o briefing profissional quando fornecido e adapte a composição ao enquadramento de cada formato.`;

if (!creativeSource.includes("determine dinamicamente o protagonista visual real")) {
  if (!creativeSource.includes(originalUserImageInstruction)) {
    throw new Error("Creative image user instruction not found in final generator source");
  }
  creativeSource = creativeSource.replace(originalUserImageInstruction, dynamicUserImageInstruction);
}

const originalProductAnchor = '  const productAnchor = `${productName} — exact product as specified, preserve real appearance, proportions and category`;';
const dynamicProductAnchor = '  const productAnchor = `${productName} — exact commercial subject as specified; preserve real appearance, proportions and category; keep the requested commercial protagonist visually dominant over supporting people and scenery`;';

if (!creativeSource.includes("keep the requested commercial protagonist visually dominant")) {
  if (!creativeSource.includes(originalProductAnchor)) {
    throw new Error("Creative image product anchor not found in final generator source");
  }
  creativeSource = creativeSource.replace(originalProductAnchor, dynamicProductAnchor);
}

for (const marker of [
  "ANÁLISE DINÂMICA DO FOCO COMERCIAL",
  "o produto deve ser o protagonista inequívoco da composição",
  "Pessoas podem demonstrar uso, escala, benefício ou contexto",
  "Não aplique a regra de produto dominante onde não houver produto físico central",
  "Não use automaticamente pessoa em primeiro plano",
  "determine dinamicamente o protagonista visual real",
  "keep the requested commercial protagonist visually dominant",
]) {
  if (!creativeSource.includes(marker)) throw new Error(`Dynamic image hierarchy marker missing: ${marker}`);
}

writeFileSync(creativeFileUrl, creativeSource, "utf8");
console.log("Gerador de Imagem now determines commercial visual hierarchy dynamically for every request.");
