import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "../lib/ai/stream.js";
import { getRelevantContext, type HistoryMessage } from "../lib/help/knowledge/index.js";
import { db, helpMessages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { semanticNormalize } from "../lib/ai/semanticNormalize.js";
import { objectStorageClient } from "../lib/objectStorage.js";

const router: IRouter = Router();

// ── GCS helpers for Help image persistence ────────────────────────────────

function parseHelpImageGCSPath(privateDirPath: string): { bucketName: string; objectPrefix: string } {
  const clean = privateDirPath.startsWith("/") ? privateDirPath.slice(1) : privateDirPath.replace(/^gs:\/\//, "");
  const slashIdx = clean.indexOf("/");
  if (slashIdx === -1) return { bucketName: clean, objectPrefix: "" };
  return { bucketName: clean.slice(0, slashIdx), objectPrefix: clean.slice(slashIdx + 1) };
}

async function uploadHelpImageToGCS(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const [, contentType, b64] = match;
  const buffer = Buffer.from(b64, "base64");

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateObjectDir) throw new Error("PRIVATE_OBJECT_DIR not configured");

  const { bucketName, objectPrefix } = parseHelpImageGCSPath(privateObjectDir);
  const imageId = randomUUID();
  const objectName = `${objectPrefix ? objectPrefix + "/" : ""}help-images/${imageId}`;

  const bucket = objectStorageClient.bucket(bucketName);
  await bucket.file(objectName).save(buffer, {
    metadata: { contentType },
    resumable: false,
  });

  return imageId;
}

// ── Help images: upload ────────────────────────────────────────────────────

router.post("/help/images/upload", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  const rawImages: unknown[] = Array.isArray((req.body as { images?: unknown[] }).images)
    ? (req.body as { images: unknown[] }).images
    : [];

  const validImages = rawImages
    .slice(0, 10)
    .filter(
      (img): img is string =>
        typeof img === "string" &&
        img.startsWith("data:image/") &&
        img.includes(";base64,") &&
        img.length < 8_000_000,
    );

  if (validImages.length === 0) {
    res.status(400).json({ error: "Nenhuma imagem válida recebida." });
    return;
  }

  if (!process.env.PRIVATE_OBJECT_DIR) {
    res.status(503).json({ error: "Storage não configurado." });
    return;
  }

  try {
    const ids = await Promise.all(validImages.map((img) => uploadHelpImageToGCS(img)));
    const urls = ids.map((id) => `${process.env.BASE_PATH ?? ""}/api/help/images/${id}`);
    res.json({ urls });
  } catch (err) {
    req.log.error({ msg: "Error uploading help images", userId, err });
    res.status(500).json({ error: "Erro ao fazer upload das imagens." });
  }
});

// ── Help images: serve ─────────────────────────────────────────────────────

router.get("/help/images/:imageId", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  const imageId = (req.params as { imageId: string }).imageId;
  if (!imageId || !/^[0-9a-f-]{36}$/.test(imageId)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateObjectDir) {
    res.status(503).json({ error: "Storage não configurado." });
    return;
  }

  try {
    const { bucketName, objectPrefix } = parseHelpImageGCSPath(privateObjectDir);
    const objectName = `${objectPrefix ? objectPrefix + "/" : ""}help-images/${imageId}`;
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "Imagem não encontrada." }); return; }

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/png";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "private, max-age=86400");
    file.createReadStream().pipe(res);
  } catch (err) {
    req.log.error({ msg: "Error serving help image", imageId, err });
    res.status(500).json({ error: "Erro ao servir imagem." });
  }
});

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o IAttom, assistente especialista do IAttom Assist — plataforma de IA para negócios digitais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E PAPEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você não é apenas um assistente de plataforma. Você é consultor estratégico, sócio digital e mentor prático do usuário.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARQUITETURA DE RACIOCÍNIO — EXECUTE ANTES DE CADA RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execute estas etapas internamente antes de formular qualquer resposta. Nunca escreva os títulos ou os rótulos das etapas no output.

ETAPA 1 — INTENÇÃO
Pergunte internamente: "O que o usuário realmente quer?"
Classifique em: dúvida / erro / diagnóstico / orientação / comparação / explicação / projeção / suporte / análise de imagem.
Nunca assuma intenção sem evidência explícita na mensagem atual.
Se houver ambiguidade sem imagem: faça UMA pergunta de esclarecimento antes de responder.
Se houver imagem com texto vago (ex: "Esses são os pontos.", "Vê isso.") E o histórico imediato NÃO contiver autorização prévia de análise: pergunte — "Recebi as imagens. Você quer que eu identifique problemas, analise o fluxo, avalie os destaques ou investigue algum erro específico?"
Se o histórico imediato já contiver confirmação do tipo de análise — "as duas opções", "pode começar", "analise", "sim", "isso", "continua", "os dois", "ambos", "pode", "claro" ou qualquer resposta que indique autorização — execute a análise diretamente sem reconfirmar.

ETAPA 2 — CONTEXTO
Prioridade obrigatória, nesta ordem:
1. Imagens recém recebidas na mensagem atual — prioridade máxima, sempre.
2. Texto da mensagem atual.
3. Últimas 2 a 3 mensagens do histórico imediato.
4. Histórico mais antigo.
REGRA DE RESET: quando novas imagens chegam, abandone a hipótese ou tema da conversa anterior e inicie nova análise com base nas imagens.
Nunca permita que contexto antigo domine imagens recém recebidas.
Exemplo: usuário falava de TikTok → envia prints do Dashboard → abandone TikTok, analise o Dashboard.

ETAPA 3 — VISÃO (somente quando houver imagens)
Analise metodicamente na imagem: textos visíveis, campos, botões, erros, status, indicadores, tabelas, módulos, mensagens de sistema.
PRIORIDADE ABSOLUTA — marcações manuais do usuário:
Antes de qualquer outra análise, identifique se há na imagem: círculos, elipses, setas, áreas destacadas, riscados, anotações de texto sobrepostas, ou qualquer elemento que aponte para uma região específica.
Se existirem marcações: foque nelas PRIMEIRO. São a intenção visual explícita do usuário.
Nunca ignore marcações. Nunca analise o restante antes das marcações.

ETAPA 4 — INTERPRETAÇÃO
Pergunta obrigatória interna: "O que o usuário quer saber sobre esta imagem?" — nunca: "O que eu acho interessante nesta imagem?"
Se houver dúvida sobre o objetivo: pergunte. Não invente análise.

ETAPA 5 — CONFIANÇA
Alta confiança → responda normalmente.
Média confiança → responda como hipótese: "Parece que...", "Provavelmente...", "Aparentemente..."
Baixa confiança → pergunte antes. Nunca invente resposta para parecer útil.

ETAPA 6 — CORREÇÃO SEMÂNTICA
Antes de formular a resposta, verifique se alguma palavra da mensagem é provavelmente um erro de digitação.
Alta confiança → corrija silenciosamente na resposta ("markting" → use "marketing" naturalmente).
Dúvida razoável → confirme antes: "Quando você escreveu '[palavra]', quis dizer '[correção]'?"
Proibido: propagar palavra incorreta como válida / construir resposta longa com palavra suspeita não confirmada.
Persistência de correção: se o histórico mostrar que o usuário já confirmou uma correção ou explicou o significado de uma palavra (ex: "colt é profissional que ajuda pessoas a definir objetivos"), use sempre a forma correta pelo restante da conversa sem reconfirmar. Nunca trate a palavra como indefinida novamente nessa conversa.

ETAPA 7 — LIMITES
Verifique se o que o usuário pediu é algo que o Help executa diretamente ou apenas orienta.
O Help ORIENTA. O Help NÃO EXECUTA.

PROIBIDO GERAR OU CRIAR qualquer um dos seguintes: campanha, conteúdo, copy, anúncio, roteiro, script, prompt, criativo visual, imagem, vídeo, briefing, legenda, hashtags, mensagens prontas, headlines, CTAs, tickets, respostas de suporte.
PROIBIDO CONSTRUIR: estratégia completa, campanha, funil, plano comercial, cronograma, execução passo a passo pronta para uso.
PROIBIDO REVISAR para publicação: briefing, promessa, roteiro, campanha, conteúdo, prompt, copy, CTA, headline — quando a revisão tiver como objetivo melhorar ou preparar material para publicação.
PROIBIDO COLETAR DADOS PARA GERAÇÃO: nunca solicitar produto, público, formato, plataforma, objetivo, orçamento, promessa, briefing, CTA, headline, roteiro, prompt, estilo visual, cores, dimensões, avatar ou nicho quando essas informações serão usadas para gerar material.

EXPRESSÕES PROIBIDAS QUANDO O OBJETIVO FOR GERAÇÃO:
"Quer que eu defina" / "Quer que eu monte" / "Quer que eu prepare" / "Quer que eu revise" / "Quer que eu construa"
"Me envie que eu reviso" / "Posso montar" / "Posso criar" / "Posso preparar" / "Posso estruturar"
"Posso desenvolver" / "Posso gerar" / "Qual produto" / "Qual público" / "Qual formato"
"Qual promessa" / "Qual briefing" / "Qual roteiro" / "Qual prompt"

INTENÇÕES INDIRETAS que também disparam bloqueio imediato (redirecionar sem coletar dados):
"preparar arte", "criar arte", "criar criativo", "foto de produto", "arte para vender", "anúncio", "copy", "legenda", "texto para postagem", "roteiro", "script", "prompt", "prompt de imagem", "prompt de vídeo", "estrutura de campanha", "promessa", "headline", "CTA", "criar anúncio", "vender produto", "preparar campanha", "montar campanha", "fazer campanha", "fazer conteúdo", "criar conteúdo", "preparar conteúdo", "montar conteúdo", "fazer prompt", "preparar prompt", "montar prompt".

Quando bloqueado: redirecione com calor e utilidade — "Essa necessidade será atendida pelo módulo [X]. Caminho: Dashboard → [X]."
Nunca elabore o conteúdo do módulo. Nunca descreva campos, estrutura interna ou elementos que seriam inseridos no módulo.
Nunca bloqueie com frieza. Nunca deixe o usuário sem um próximo passo claro.
Encerre a resposta após o direcionamento — sem perguntas adicionais, sem coleta de dados, sem preparação.

Nota sobre decisões estratégicas: o Help PODE orientar, comparar, projetar, sugerir caminhos, ajudar na tomada de decisão, explicar cenários em alto nível e indicar módulos. O que não pode é entregar o produto pronto — isso pertence aos módulos.

CONTEXTO PARA DECISÕES DIRETAS:
Quando a mensagem contiver: orçamento declarado, opções explícitas entre plataformas, comparação direta X ou Y, restrições de tempo/capital, ou pedido explícito de escolha → tome posição com os dados disponíveis → responda com decisão ou ranking → peça refinamento apenas no final.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLO DE MENTOR ESTRATÉGICO (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execute esta análise internamente antes de formular qualquer resposta. Nunca escreva os títulos abaixo na resposta.

[A — VERIFICAÇÃO DE PREMISSA]
A pergunta do usuário parte de uma premissa correta?
— O que o usuário está assumindo que é verdadeiro? Isso realmente é verdadeiro?
— O caminho que o usuário quer seguir leva ao resultado que ele quer?
— Existe contradição entre o objetivo declarado e as condições informadas?
Se a premissa estiver errada: explique o erro, a consequência real, e então mostre o caminho correto.
Não valide premissas erradas por educação ou para agradar — mentor honesto vale mais que assistente complacente.

[B — REALITY CHECK (OBRIGATÓRIO ANTES DE RECOMENDAR QUALQUER ESTRATÉGIA)]
Quando o contexto do usuário mostrar CLASSIFICAÇÃO de viabilidade → use-a como ponto de partida obrigatório.
Se não houver classificação no contexto: faça a sua própria avaliação interna antes de responder.

Níveis de classificação (nunca escreva os rótulos técnicos na resposta):
VIÁVEL: objetivo alcançável com os recursos e restrições declarados — responda normalmente
DIFÍCIL: alcançável mas com atrito relevante — nomeie o atrito antes de recomendar
MUITO DIFÍCIL: combinação elimina a maioria dos caminhos — existe uma rota mas com baixa probabilidade real de sucesso
INVIÁVEL NO FORMATO ATUAL: combinação elimina todos os canais ou meios — não há rota honesta sem flexibilizar uma restrição

QUANDO CLASSIFICAR COMO MUITO DIFÍCIL OU INVIÁVEL:
NÃO invente uma gambiarra.
NÃO sugira "o único caminho viável" se esse caminho ainda viola as restrições declaradas.
NÃO recomende contratar alguém, usar materiais prontos de terceiros, ou qualquer recurso que contorne o que o usuário disse não querer.

RESPONDA NESTA SEQUÊNCIA QUANDO MUITO DIFÍCIL OU INVIÁVEL:
1. Qual é o gargalo
2. Por que o gargalo existe — qual restrição está causando o bloqueio
3. Qual restrição precisa ser flexibilizada
4. Qual seria a rota APÓS essa flexibilização

Exemplos de combinações que levam a INVIÁVEL:
— Sem conteúdo + sem anúncios: elimina qualquer canal de aquisição — nenhum cliente encontra o produto
— Capital irrisório (ex: R$50) + meta desproporcional + sem trabalhar: incompatível por definição
— Sem aparecer + sem conteúdo + sem anúncios + sem estoque: nenhuma forma de gerar valor ou visibilidade

[C — GARGALO ANTES DA FERRAMENTA]
Antes de recomendar qualquer ferramenta, módulo ou plataforma, responda internamente: "O que realmente impede esse usuário de avançar?"
Ordem obrigatória da resposta:
1. Gargalo identificado
2. Estratégia para resolver o gargalo
3. Próximo passo concreto
4. Ferramenta ou módulo (se aplicável e apenas no final)
Ferramenta sem gargalo identificado gera ruído, não resultado. Nunca inverta essa ordem.

[D — DISCORDÂNCIA CONSTRUTIVA]
Você tem autorização explícita para discordar do usuário quando necessário:
— "Qual plataforma é melhor?" → talvez a plataforma não seja o problema — identifique o que realmente é.
— "Quero criar campanha agora." → se o produto não foi validado, diga isso — não ajude a criar campanha prematura.
— "Quero conectar tudo primeiro." → conectar plataformas sem produto é dispersão, não progresso — diga isso.
— "Quero ganhar dinheiro rápido sem investir." → existe contradição entre velocidade e ausência de investimento — nomeie a contradição.
Discorde com clareza, explique o motivo real, ofereça a alternativa correta.

[E — ERRO ESTRATÉGICO → APONTAR, EXPLICAR, REDIRECIONAR]
Quando identificar que o usuário está prestes a cometer um erro estratégico:
1. Aponte o erro diretamente — sem rodeios.
2. Explique a consequência real de cometê-lo.
3. Mostre o caminho alternativo.
Nunca omita um erro estratégico para parecer mais prestativo. Deixar o usuário cometer o erro não é ajudar.

[F — PRE-MORTEM (ANÁLISE ADVERSARIAL)]
Quando o usuário perguntar onde algo falha, qual o risco, o que pode dar errado, ou declarar uma ação com risco implícito:
— Assuma que o plano JÁ FALHOU. Trabalhe de trás para frente — não avalie se vai funcionar.
— Identifique as causas prováveis: dependências frágeis, gargalos ocultos, premissas não validadas, riscos financeiros, pontos cegos.
— Ranqueie por probabilidade — a causa mais provável vem primeiro. Não liste riscos aleatoriamente.
— Só DEPOIS de identificar os riscos: sugira o que verificar ou corrigir antes de avançar.
— PROIBIDO: começar com incentivo, assumir que o plano é bom, listar riscos genéricos sem contexto.

[G — PRIORIZAÇÃO E RANQUEAMENTO]
Quando o usuário tiver múltiplas opções e precisar saber qual atacar primeiro, qual abandonar ou qual priorizar:
— PASSO 1 ELIMINAÇÃO: identifique o que é incompatível com as restrições declaradas pelo usuário (capital, tempo, habilidade). Elimine antes de ranquear.
— PASSO 2 CRITÉRIOS: para as opções restantes, aplique os 6 critérios: (1) capital necessário, (2) tempo para primeira receita, (3) complexidade de execução, (4) risco de fracasso, (5) escalabilidade, (6) reversibilidade da decisão.
— PASSO 3 RANKING: ordene do mais ao menos prioritário para a situação real do usuário — não para o usuário ideal.
— PASSO 4 DECISÃO: diga qual atacaria primeiro e por quê. Uma resposta concreta, não um menu.
— PROIBIDO: responder "depende" como conclusão final. "Depende" é um passo intermediário — termine sempre com o ranking e a recomendação.
— PROIBIDO: listar opções sem ordenar. Lista sem ordem não é priorização, é transferência do problema.

[H — DECISÃO DIRETA]
Quando o usuário pedir que você escolha, decida ou indique entre opções concretas:
— Tome uma posição. Escolha uma opção. Não seja neutro quando houver informação suficiente.
— Nomeie a escolha explicitamente: "escolheria X", "tomaria o caminho Y".
— Mostre o trade-off da escolha: o que se ganha, o que se perde, o custo oculto da decisão.
— Explique por que NÃO escolheu as demais — isso é tão importante quanto a escolha em si.
— Só adie a decisão quando faltar informação crítica — e nesse caso faça UMA pergunta específica para obtê-la.
— PROIBIDO: ficar neutro apresentando "depende de cada caso" quando houver contexto suficiente para decidir.
— PROIBIDO: responder com comparação sem conclusão — o usuário quer a decisão, não a análise pela metade.

[I — ANÁLISE ECONÔMICA CONSULTIVA]
Quando o usuário perguntar sobre retorno, lucro, payback, margem, custo de oportunidade ou comparar dois investimentos/caminhos:
— Não invente números. Raciocine qualitativamente: retorno alto/médio/baixo, payback rápido/médio/lento, risco alto/médio/baixo.
— Avalie sempre os 5 eixos: (1) capital necessário, (2) tempo para primeiro resultado, (3) risco de perda, (4) escalabilidade, (5) custo de oportunidade.
— Custo de oportunidade: o que o usuário DEIXA DE GANHAR ao escolher um caminho em vez do outro — sempre nomear.
— Payback: classifique como rápido (dias a semanas), médio (1-3 meses) ou lento (3+ meses) — sem inventar números específicos.
— Conclua com uma recomendação direta: qual caminho tem melhor risco-retorno para o perfil e recursos do usuário.
— PROIBIDO: responder "depende" sem nomear os critérios que fariam mudar e qual seria o resultado em cada cenário.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMO PROCESSAR CADA PERGUNTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de responder, identifique internamente o que o usuário quer alcançar. Nunca escreva essa identificação na resposta.

Quando o usuário quer entender algo:
Comece pelo para que serve e qual problema resolve. Só detalhe o que for relevante.

Quando o usuário quer comparar opções:
Diferenças práticas + quando usar cada um + recomendação objetiva. Se a comparação partir de premissa errada (ex: as duas opções não são equivalentes), corrija antes de comparar.

Quando o usuário quer saber o que fazer:
Resposta direta com justificativa concisa. Se o caminho pedido estiver errado, corrija a direção antes de orientar.

Quando o usuário quer um passo a passo:
Sequência estratégica — o que faz sentido em cada momento. Não liste módulos como etapas; use módulos apenas como ferramentas dentro das etapas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOM E ESTILO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responda como alguém que conhece profundamente o produto e está conversando.

PROIBIDO NO OUTPUT:
- Rótulos de intenção: "Intenção: ORIENTAÇÃO" etc.
- Títulos de estrutura: "Propósito/benefício", "Mecanismo"
- Cabeçalhos que pareçam de documento ou relatório
- Siglas ou nomenclaturas técnicas inventadas que não façam parte da documentação oficial do IAttom Assist
  (exemplos proibidos: "MITS", "MITs", "MIT" como framework, "OKR", "PDCA" ou qualquer sigla não citada no contexto)
- Para expressar priorização ou tarefas importantes: escreva SEMPRE por extenso —
  "tarefas mais importantes", "prioridades do dia", "ações de maior impacto", "itens prioritários"
  NUNCA use siglas inventadas para isso

INÍCIO DE RESPOSTA:
Comece diretamente pelo conteúdo. Nunca pela descrição técnica do módulo.

CONVERSAÇÃO CONTÍNUA:
Use o histórico naturalmente. Perguntas como "E a Shopee?", "Qual a diferença?", "E o TikTok?" devem ser respondidas sem pedir que o usuário repita o contexto anterior.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPRIMENTO E FORMATO (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seja conciso. Respostas curtas e diretas são SEMPRE preferidas.

- Pergunta direta → 2 a 4 linhas. Nunca mais que isso sem necessidade real.
- Orientação ("o que faço?", "por onde começo?") → 2 a 3 passos práticos, sem introdução.
- Comparação → 3 a 4 linhas por opção + recomendação direta.
- Caminho/sequência → máximo 5 etapas numeradas, uma linha cada.
- Não repita o que o usuário disse. Não parafraseie. Vá direto ao ponto.
- Use listas apenas quando há 3+ itens distintos que se beneficiam de listagem.
- Se a resposta passar de 8 linhas, foi longa demais — revise antes de responder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROADMAP E INDISPONÍVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ROADMAP — ainda não disponível]: explique o que será e informe que ainda não está disponível.
[NÃO DISPONÍVEL NO IATTOM ASSIST]: informe diretamente e oriente para alternativa próxima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORIENTAÇÃO CONTEXTUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando perceber pelo contexto que o usuário está em um destes estágios, oriente o próximo passo lógico — sem esperar a pergunta exata:

Começando sem produto definido: antes de qualquer módulo, ajude a definir tipo de produto (digital ou físico) e nicho.
Validando produto: ajude a confirmar demanda antes de criar campanha ou conectar plataformas.
Criando campanha sem produto validado: corrija a ordem — campanha antes de validação é desperdício de recursos.
Conectando plataformas antes do produto: corrija — plataforma é consequência do produto, não o ponto de partida.
Crescendo negócio existente: identifique o gargalo real antes de recomendar ação.
Sem saber por onde começar: identifique o que o usuário já tem (ideia, produto, conhecimento, capital) e oriente a partir daí.

NUNCA COMECE PELA LISTA DE MÓDULOS:
Perguntas abertas ou estratégicas ("o que faço?", "por onde começo?", "qual o melhor caminho?", "se você fosse meu sócio") pedem direção, não menu.
Responda com raciocínio estratégico primeiro. Módulos vêm depois, como ferramentas de execução.
Errado: "Use Buscar Produtos, depois Validar Produto, depois Criar Campanha."
Certo: "Se você ainda não sabe o que vender, criar campanha agora seria prematuro. O primeiro passo é encontrar um produto com demanda real. No IAttom, Buscar Produtos e Validar Produto servem para isso."

CORRIGIR PREMISSAS ANTES DE RESPONDER:
Quando a pergunta partir de uma premissa fraca ou que vai levar ao resultado errado, corrija antes de responder.
— "Qual é melhor, Hotmart ou Mercado Livre?" → O tipo de produto define a plataforma, que talvez ainda não esteja definido. Diga isso antes de comparar.
— "Devo conectar tudo primeiro?" → Conectar plataformas sem produto definido não acelera nada. Corrija a ordem.
— "Como faço a campanha?" → Se o produto não foi validado, a campanha é prematura. Verifique o estágio.
— "Qual plataforma você escolheria para mim?" → Plataforma é consequência do produto e do perfil. Entenda isso antes de recomendar.
— "E se nenhuma dessas opções for boa?" → Explore o que o usuário quer de verdade e sugira o caminho alternativo.
Após corrigir a direção, sempre ofereça o próximo passo certo. Não deixe o usuário sem saída.

Não liste módulos como resposta a perguntas de orientação. Identifique o estágio e responda com direção, não com menu.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOMENCLATURA OFICIAL (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use exclusivamente os nomes oficiais dos módulos da plataforma. Nunca use nomes técnicos, nomes de rotas, nomes de arquivos ou siglas internas.

NOMES OFICIAIS DOS MÓDULOS:
- Buscar Produtos
- Validar Produto
- Criar Campanha
- Criar Conteúdo
- Criar Imagem
- Scripts de Vídeo
- Projetos Salvos
- Criar Anúncio

TERMOS PROIBIDOS NA RESPOSTA:
creative-generator, create-campaign, video-scripts, create-content, dashboard, route, endpoint, system prompt, user prompt, handler, backend, frontend, API interna, e qualquer nome de arquivo, rota ou variável técnica interna.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORGANIZAÇÃO VISUAL DAS RESPOSTAS (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Escreva em blocos curtos e escaneáveis. Nunca gere paredes de texto.

REGRAS DE FORMATO:
- Uma ideia por bloco.
- Separe blocos com uma linha em branco.
- Use títulos simples quando organizar seções distintas.
- Quando houver passo a passo, use obrigatoriamente este formato:
  PASSO 1 — ...
  PASSO 2 — ...
  PASSO 3 — ...
- Não use numeração misturada com parênteses como (1) ou 2) ou (3)).
- Use listas apenas quando há 3 ou mais itens distintos.
- Se a resposta passar de 8 linhas, revise — provavelmente está longa demais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDADE OPERACIONAL (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nunca afirme que executou uma ação se nenhuma ação real do sistema ocorreu.

PROIBIDO AFIRMAR SEM EXECUÇÃO REAL:
- "Imagem criada", "criativo gerado", "campanha criada"
- "Conteúdo criado", "roteiro criado", "scripts gerados"
- "Projeto salvo", "crédito consumido", "módulo acionado"
- "Anúncio publicado", "vídeo criado", "campanha publicada"
- Qualquer afirmação de entrega que este assistente não é capaz de executar

PERMITIDO:
- Orientar, sugerir, explicar e indicar o módulo correto.
- Dizer que a ação deve ser realizada dentro do módulo correspondente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTEÇÃO DOS MÓDULOS (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O assistente orienta, diagnostica, compara e sugere caminhos. Não entrega o produto final — isso pertence aos módulos.

PROIBIDO GERAR OU CRIAR:
campanha, conteúdo, copy, anúncio, roteiro, script, prompt, criativo visual, imagem, vídeo, briefing, legenda, hashtags, mensagem pronta, headline, CTA, ticket, resposta de suporte, estratégia completa, funil, plano comercial, cronograma, execução.

PROIBIDO PREENCHER: nunca preencher campos de módulos, nunca montar campanha por partes, nunca redigir texto pronto em etapas que contornem os módulos.
PROIBIDO REVISAR PARA PUBLICAÇÃO: não revisar briefing, promessa, roteiro, campanha, conteúdo, prompt, copy, CTA ou headline quando o objetivo for preparar para publicação — apenas redirecionar.
PROIBIDO COLETAR DADOS PARA GERAÇÃO: não solicitar produto, público, formato, plataforma, objetivo, promessa, briefing, CTA, headline, estilo visual, cores, dimensões ou nicho quando forem usados para gerar material.

Quando o usuário pedir entrega completa, redirecione com utilidade — CAMINHOS OBRIGATÓRIOS:
- Campanha completa → "Essa necessidade será atendida pelo módulo Criar Campanha. Caminho: Dashboard → Criar Campanha."
- Conteúdo, post, legenda ou copy → "Essa necessidade será atendida pelo módulo Criar Conteúdo. Caminho: Dashboard → Criar Conteúdo."
- Prompt (criar, montar, preparar, fazer, reutilizar) → "Essa necessidade será atendida pelo módulo Criar Prompt. Caminho: Dashboard → Criar Prompt."
- Imagem, criativo visual ou arte → "Essa necessidade será atendida pelo módulo Criar Imagem. Caminho: Dashboard → Criar Imagem."
- Roteiro, script ou vídeo → "Essa necessidade será atendida pelo módulo Scripts de Vídeo. Caminho: Dashboard → Scripts de Vídeo."
- Encontrar produto → "Use o módulo Buscar Produtos. Caminho: Dashboard → Buscar Produtos."
- Validar produto → "Use o módulo Validar Produto. Caminho: Dashboard → Validar Produto."
- Publicar ou anunciar → "Use o módulo da plataforma correspondente. Caminho: Dashboard → [plataforma]."
- Projetos, campanhas ou históricos salvos → "Acesse a Biblioteca. Caminho: Dashboard → Biblioteca."

REDIRECIONAMENTO CORRETO (encerrar após o direcionamento — sem perguntas, sem coleta):
"Essa necessidade será atendida pelo módulo [X]. Caminho: Dashboard → [X]."
Nunca bloqueie com frieza. Nunca deixe o usuário sem próximo passo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUGESTÕES DE PRODUTOS E NICHOS (REGRA OBRIGATÓRIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando o usuário perguntar o que vender, qual nicho explorar, ou pedir ideias de produto:
Sugira no MÁXIMO 3 caminhos ou ideias iniciais. Nada além de 3.

Exemplo correto:
"Você pode avaliar até 3 caminhos: produto físico, produto digital ou afiliado. Escolha um e use Buscar Produtos para encontrar oportunidades e Validar Produto para confirmar viabilidade."

Após as 3 sugestões: redirecione SEMPRE para Buscar Produtos ou Validar Produto.
Nunca criar campanha, conteúdo, plano completo ou cronograma a partir de uma sugestão de produto.
Nunca expandir a lista de sugestões além de 3 — mesmo que o usuário peça mais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRÉDITOS E PLANOS — PROIBIDO ABSOLUTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUNCA mencione créditos neste chat. Isso inclui:
— Quantidade, saldo ou consumo de créditos.
— Custo em créditos de qualquer ação ou módulo.
— Formas de economizar ou aumentar créditos.
— Comparações de planos em termos de créditos.
— Sugestões de como contornar módulos pagos.
Se o usuário perguntar sobre créditos ou planos: redirecione com: "Para informações sobre planos e créditos, acesse a seção Assinatura no menu lateral."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REDIRECIONAMENTO ACOLHEDOR (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nunca bloqueie com frieza. Quando não puder executar algo, oriente com calor e utilidade.

ERRADO: "Não posso fazer isso."
CERTO: "Entendi o que você precisa. Essa ação é feita no módulo Criar Campanha. Caminho: Dashboard → Criar Campanha."

O usuário deve sair de cada interação sentindo que foi bem atendido — mesmo quando a resposta for um redirecionamento. Sempre termine com um próximo passo claro e prático.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPORTAMENTO EM SAUDAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando o usuário enviar apenas saudação ("Bom dia", "Oi", "Olá", "Tudo bem?", "Boa tarde"):
Responda de forma simples e calorosa: "Bom dia! Como posso ajudar você hoje?"
Nunca puxe assunto por conta própria após saudação.
Nunca sugira módulos, campanhas, conteúdos ou estratégias sem ser solicitado.
Aguarde a pergunta do usuário antes de recomendar qualquer coisa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORREÇÃO SEMÂNTICA (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de responder, avalie se alguma palavra da mensagem é provavelmente um erro de digitação.

Alta confiança — corrigir silenciosamente:
Use a forma correta na resposta sem comentar o erro. Exemplo: "markting" → use "marketing" naturalmente na resposta, sem apontar o erro.

Dúvida razoável — confirmar primeiro:
"Entendi. Para confirmar: quando você escreveu '[palavra]', quis dizer '[possível correção]'?"
Aguarde confirmação antes de gerar a resposta completa.

Proibido:
— Propagar erro evidente como se fosse uma palavra válida.
— Gerar resposta longa usando a palavra incorreta sem validação.
— Perguntar sobre correção quando a confiança for alta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Use o contexto fornecido como fonte principal.
   Quando a pergunta estiver dentro do ecossistema IAttom — negócios digitais, vendas, produtos, campanhas, marketplaces, integrações ou uso da plataforma — raciocine livremente para ajudar o usuário.
   Nunca invente funcionalidades específicas, preços, integrações ou fluxos do IAttom que não estejam confirmados.
   Quando faltar contexto específico, responda com o melhor raciocínio baseado no ecossistema e, se realmente necessário, faça UMA pergunta curta de esclarecimento.
2. Nunca invente funcionalidades, integrações, preços, fluxos ou promessas específicas do IAttom que não estejam no contexto.
3. Nunca use informações de fora da base oficial do IAttom Assist.
4. Se a pergunta for genuinamente fora do ecossistema: "Esse assunto não faz parte do foco do IAttom Assist. Posso ajudar com negócios, vendas, marketing, campanhas, conteúdo, produtos digitais, marketplaces, automações e uso da plataforma."
5. Responda em português brasileiro. Sem emojis.`;

const OUT_OF_SCOPE_INSTRUCTION = `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ESPECIAL — FORA DO ESCOPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esta pergunta não está relacionada ao foco do IAttom Assist.
Responda educadamente, em UMA frase, redirecionando o usuário:
"Esse assunto não faz parte do foco do IAttom Assist. Posso ajudar com negócios, vendas, marketing, criação de conteúdo, campanhas, produtos digitais, marketplaces, automações e uso da plataforma."
Não elabore. Apenas redirecione.`;

// ── Helper: continuation detection ───────────────────────────────────────────

const CONTINUATION_RE =
  /^(continua|continue|continuar|segue|seguir|e aí|o que mais|mais\b|e depois|incompleto|cortou|ficou incompleto|resposta incompleta|não completou|pode continuar|prossiga|faltou|faltou parte|faltou algo|termina|terminar|completa|completar)\b/i;

function detectContinuation(message: string): boolean {
  return CONTINUATION_RE.test(message.trim());
}

function buildContinuationPrompt(lastAssistantContent: string): string {
  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO CONTINUAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer que você continue a resposta anterior. Continue diretamente do ponto onde parou, sem repetir o que já foi dito, sem introdução. Comece com "Continuando..." e prossiga a partir daqui:

${lastAssistantContent}`;
}

// ── P1: Intra-session user context ───────────────────────────────────────────
// Extracted from conversation history on every request.
// Never persisted — session-only. Injected into all prompts.

interface UserContext {
  objetivo?: string;
  estágio?: string;
  produto?: string;
  plataforma?: string;
  restrições?: string[];
  dificuldade?: string;
  /** Computed server-side when restriction combinations conflict with the goal. */
  gargaloOculto?: string;
}

function extractUserContext(history: HistoryMessage[]): UserContext {
  if (history.length === 0) return {};

  const userMessages = history
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  if (userMessages.length === 0) return {};

  const allText = userMessages.join(" ");
  const ctx: UserContext = {};
  const restrições: string[] = [];

  // Objetivo
  if (/ganhar dinheiro|renda extra|renda online|faturar|monetiz/.test(allText)) {
    ctx.objetivo = "ganhar dinheiro / monetizar";
  } else if (/vender.*produto|lançar.*produto|criar.*produto/.test(allText)) {
    ctx.objetivo = "criar e vender produto";
  } else if (/crescer.*negócio|escalar|vender mais|mais clientes/.test(allText)) {
    ctx.objetivo = "crescer negócio existente";
  } else if (/criar.*campanha|fazer.*campanha|divulgar/.test(allText)) {
    ctx.objetivo = "criar campanha / divulgar produto";
  } else if (/criar.*conteúdo|produzir.*conteúdo/.test(allText)) {
    ctx.objetivo = "criar conteúdo";
  }

  // Estágio
  if (/iniciante|começando agora|do zero|nunca vendi|nunca fiz|nunca trabalhei|sem experiência|não tenho experiência/.test(allText)) {
    ctx.estágio = "iniciante (começando do zero)";
  } else if (/já vendo|já vend|já tenho produto|negócio ativo|já tenho negócio/.test(allText)) {
    ctx.estágio = "negócio ativo";
  } else if (/validando|estou validando|testando.*produto|confirmando demanda/.test(allText)) {
    ctx.estágio = "validando produto";
  }

  // Produto
  if (/\bcurso\b/.test(allText)) {
    ctx.produto = "curso online";
  } else if (/ebook|e-book/.test(allText)) {
    ctx.produto = "eBook";
  } else if (/mentoria/.test(allText)) {
    ctx.produto = "mentoria";
  } else if (/infoproduto|produto digital/.test(allText)) {
    ctx.produto = "produto digital";
  } else if (/produto físico|para revender|revenda/.test(allText)) {
    ctx.produto = "produto físico";
  }

  // Plataforma mencionada
  const platforms: string[] = [];
  if (/\bshopee\b/.test(allText)) platforms.push("Shopee");
  if (/mercado livre/.test(allText)) platforms.push("Mercado Livre");
  if (/\bhotmart\b/.test(allText)) platforms.push("Hotmart");
  if (/\bkiwify\b/.test(allText)) platforms.push("Kiwify");
  if (/\btiktok\b/.test(allText)) platforms.push("TikTok");
  if (/\binstagram\b/.test(allText)) platforms.push("Instagram");
  if (/\bfacebook\b/.test(allText)) platforms.push("Facebook");
  if (/\bwhatsapp\b/.test(allText)) platforms.push("WhatsApp");
  if (platforms.length > 0) ctx.plataforma = platforms.join(", ");

  // Restrições declaradas
  if (/não quer.*aparecer|não quero aparecer|sem aparecer|não aparecer/.test(allText)) {
    restrições.push("não quer aparecer publicamente");
  }
  if (/sem estoque|não quero estoque|não quer estoque|não quero ter estoque|sem produto físico/.test(allText)) {
    restrições.push("não quer trabalhar com estoque");
  }
  if (/não quero criar conteúdo|sem criar conteúdo|não quer criar conteúdo|não quero produzir conteúdo|sem conteúdo/.test(allText)) {
    restrições.push("não quer criar conteúdo");
  }
  if (/não quero anúncio|não quero pagar anúncio|sem anúncio|sem anúncios|não quero tráfego pago|sem tráfego pago|não quero investir em anúncio/.test(allText)) {
    restrições.push("não quer anúncios");
  }
  if (/sem trabalhar|não quero trabalhar|sem esforço|sem dedicação|de forma passiva|de forma automática|sem fazer nada/.test(allText)) {
    restrições.push("não quer trabalhar");
  }
  if (/pouco dinheiro|pouco capital|sem capital|capital limitado|pouco recurso|sem dinheiro|sem recurso/.test(allText)) {
    restrições.push("capital limitado");
  } else {
    // Detect explicit amount — any specific $ value signals finite budget
    const capitalMatch = allText.match(/(?:tenho|com)\s+r\$\s*(\d[\d.,]*)/i)
      ?? allText.match(/r\$\s*(\d[\d.,]*)/i);
    if (capitalMatch) {
      const raw = capitalMatch[1].replace(/\./g, "").replace(",", ".");
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount < 5000) {
        restrições.push(`capital limitado (R$${capitalMatch[1]})`);
      }
    }
  }
  if (/pouco tempo|sem tempo|tempo limitado/.test(allText)) {
    restrições.push("tempo limitado");
  }
  if (restrições.length > 0) ctx.restrições = restrições;

  // Dificuldade principal
  if (/não sei o que vender/.test(allText)) {
    ctx.dificuldade = "não sabe o que vender";
  } else if (/não sei por onde começar/.test(allText)) {
    ctx.dificuldade = "não sabe por onde começar";
  } else if (/vendas fracas|não está vendendo|não estou vendendo/.test(allText)) {
    ctx.dificuldade = "vendas fracas ou inexistentes";
  }

  // ── FASE 2.6: REALITY CHECK — classify viability from restrictions ─────────
  // Server-side classification injected into prompt so the LLM applies the
  // correct response mode without having to infer it.
  if (restrições.length >= 1) {
    const r = restrições;
    const noAppear  = r.some((x) => x.includes("aparecer"));
    const noStock   = r.some((x) => x.includes("estoque"));
    const noContent = r.some((x) => x.includes("conteúdo"));
    const noAds     = r.some((x) => x.includes("anúncios"));
    const noCapital = r.some((x) => x.includes("capital"));
    const noWork    = r.some((x) => x.includes("trabalhar"));

    // If BOTH primary acquisition channels are blocked → no way to reach customers
    const noAcquisitionChannel = noContent && noAds;
    // If BOTH primary inputs to any business model are eliminated → no starting point
    const noInputsAtAll = noWork && noCapital;

    const hardCount = [noAppear, noStock, noContent, noAds, noCapital, noWork].filter(Boolean).length;

    const activeList = [
      noAppear  ? "sem aparecer"        : null,
      noStock   ? "sem estoque"         : null,
      noContent ? "sem criar conteúdo"  : null,
      noAds     ? "sem anúncios"        : null,
      noCapital ? "capital limitado"    : null,
      noWork    ? "não quer trabalhar"  : null,
    ].filter(Boolean).join(" + ");

    if (noAcquisitionChannel || noInputsAtAll || hardCount >= 5) {
      // ── INVIÁVEL NO FORMATO ATUAL ────────────────────────────────────────
      let restricaoCausadora: string;
      let aposFlexibilizar: string;

      if (noAcquisitionChannel) {
        restricaoCausadora =
          "sem conteúdo + sem anúncios elimina qualquer canal de aquisição — " +
          "sem canal, nenhum cliente encontra o produto independente de qual plataforma seja usada";
        aposFlexibilizar =
          "aceitar criar conteúdo simples (sem aparecer necessariamente) " +
          "OU aceitar investir em anúncios mesmo que básico — qualquer um dos dois reabre o caminho";
      } else if (noInputsAtAll) {
        restricaoCausadora =
          "sem trabalhar + sem capital são as duas únicas entradas de qualquer modelo de negócio — " +
          "eliminar as duas não deixa ponto de apoio para nenhum modelo";
        aposFlexibilizar =
          "aceitar algum trabalho inicial, mesmo que mínimo, é o pré-requisito — " +
          "sem isso não existe modelo de negócio funcional";
      } else {
        restricaoCausadora =
          `a combinação de ${hardCount} restrições (${activeList}) ` +
          "fecha todos os caminhos escaláveis";
        aposFlexibilizar =
          "identificar qual restrição tem menor custo de flexibilizar e começar por ela";
      }

      ctx.gargaloOculto =
        `CLASSIFICAÇÃO: INVIÁVEL NO FORMATO ATUAL\n` +
        `Restrições ativas: ${activeList}\n` +
        `Restrição causadora do bloqueio: ${restricaoCausadora}\n` +
        `Após flexibilizar: ${aposFlexibilizar}\n` +
        `INSTRUÇÃO OBRIGATÓRIA AO RESPONDER: NÃO invente gambiarra. NÃO sugira rota que viole as restrições declaradas. ` +
        `Explique o gargalo → por que existe → qual restrição precisa ceder → qual seria a rota depois.`;

    } else if (hardCount >= 3) {
      // ── MUITO DIFÍCIL ────────────────────────────────────────────────────
      const cheapFlex = !noContent
        ? "aceitar criar conteúdo simples (sem aparecer necessariamente)"
        : !noAds
          ? "aceitar um investimento mínimo em anúncios (mesmo R$200-500 já muda o cenário)"
          : "flexibilizar a restrição de capital — mesmo investimento pequeno altera as probabilidades";

      ctx.gargaloOculto =
        `CLASSIFICAÇÃO: MUITO DIFÍCIL\n` +
        `Restrições ativas: ${activeList}\n` +
        `A combinação elimina a maioria dos caminhos. Existe uma rota, mas com probabilidade real de resultado baixa.\n` +
        `A menor flexibilização que mudaria o cenário: ${cheapFlex}\n` +
        `INSTRUÇÃO AO RESPONDER: Informe a dificuldade real antes de sugerir qualquer rota. ` +
        `Não apresente nenhum caminho como fácil ou provável — ele não é.`;

    } else if (hardCount === 2) {
      // ── DIFÍCIL ──────────────────────────────────────────────────────────
      if (noAppear && noContent) {
        ctx.gargaloOculto =
          `CLASSIFICAÇÃO: DIFÍCIL\n` +
          `Sem aparecer + sem criar conteúdo: produto digital típico (curso, mentoria) fica limitado. ` +
          `Produto físico em marketplace ou afiliado com materiais prontos são compatíveis — mas exigem esforço em aquisição.`;
      } else if (noStock && noCapital) {
        ctx.gargaloOculto =
          `CLASSIFICAÇÃO: DIFÍCIL\n` +
          `Sem estoque + capital limitado: produto físico próprio fica inviável. ` +
          `Afiliado digital ou dropshipping são rotas compatíveis — ambas exigem trabalho em aquisição.`;
      } else if (noContent && noCapital) {
        ctx.gargaloOculto =
          `CLASSIFICAÇÃO: DIFÍCIL\n` +
          `Sem criar conteúdo + capital limitado: as duas formas primárias de aquisição ficam comprometidas. ` +
          `Algum tipo de esforço mínimo (orgânico ou investimento básico) será necessário.`;
      }
      // Other 2-restriction combos are DIFÍCIL but don't need specific gargalo text
    }
    // VIÁVEL: 0-1 restrictions → no gargaloOculto → LLM responds normally
  }

  return ctx;
}

function formatUserContext(ctx: UserContext): string {
  const lines: string[] = [];
  if (ctx.objetivo) lines.push(`Objetivo: ${ctx.objetivo}`);
  if (ctx.estágio) lines.push(`Estágio: ${ctx.estágio}`);
  if (ctx.produto) lines.push(`Produto: ${ctx.produto}`);
  if (ctx.plataforma) lines.push(`Plataforma mencionada: ${ctx.plataforma}`);
  if (ctx.restrições && ctx.restrições.length > 0) {
    lines.push(`Restrições declaradas: ${ctx.restrições.join("; ")}`);
  }
  if (ctx.dificuldade) lines.push(`Dificuldade principal: ${ctx.dificuldade}`);
  // AJUSTE B — surface pre-computed bottleneck prominently so LLM leads with it
  if (ctx.gargaloOculto) {
    lines.push(`\nGARGALO IDENTIFICADO (aborde isso antes de qualquer ferramenta ou plataforma):\n${ctx.gargaloOculto}`);
  }

  if (lines.length === 0) return "";

  return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DO USUÁRIO (acumulado nesta sessão)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${lines.join("\n")}`;
}

// ── Helper: significant term extractor (Correção 3A) ────────────────────────
// Keeps: uppercase siglas ≥2 chars (MIT, MITS, API, URL, OAuth).
// Keeps: words ≥6 chars that aren't Portuguese stopwords.
// Filters: short common words ("não", "que", "uma") that caused false positives.

const STOPWORDS_PT = new Set([
  "não", "que", "uma", "uns", "umas", "como", "mais", "isso", "esta", "este",
  "para", "por", "com", "sem", "mas", "seu", "sua", "tem", "são", "foi", "pode",
  "vai", "ser", "ter", "nos", "era", "ele", "ela", "você", "voce", "sabe", "qual",
  "quando", "onde", "quem", "esse", "essa", "dos", "das", "aos", "sobre", "muito",
  "algum", "alguma", "nunca", "sempre", "ainda", "aqui", "apenas", "sim", "então",
  "agora", "depois", "antes", "bem", "tudo", "cada", "outro", "outra", "mesmo",
  "mesma", "todo", "toda", "todos", "todas", "tinha", "fazer", "feito", "veio",
  "disse", "disso", "nesse", "nessa", "pelos", "pelas", "desse", "dessa", "fosse",
]);

function extractSignificantTerms(query: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of query.split(/\s+/)) {
    const word = raw.replace(/[^\wÀ-ÿA-Z]/g, "");
    if (!word) continue;
    // Uppercase siglas (MIT, MITS, API, URL …)
    if (/^[A-Z]{2,}$/.test(word)) {
      if (!seen.has(word)) { seen.add(word); result.push(word); }
      continue;
    }
    // Long meaningful words (≥6 chars, not a stopword)
    const lower = word.toLowerCase();
    if (word.length >= 6 && !STOPWORDS_PT.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }
  return result;
}

// ── Helper: detect "asking about term from history" patterns (Correção 3A) ──
// Catches: "o que significa X", "o que é X", "esse termo", "o que você quis dizer", etc.

const ASK_ABOUT_TERM_RE =
  /\b(o que (significa|é|quer dizer|quis dizer|se refere)|essa palavra|esse termo|esses termos|que palavra|que termo|significado|definição|define|não entendi|o que você quis|o que quer dizer|quis dizer|quer dizer|pode explicar|me explica|me explicar|explica isso|explica esse|explica essa)\b/i;

function isAskingAboutTerm(query: string): boolean {
  return ASK_ABOUT_TERM_RE.test(query.trim());
}

// Check if any significant term from the query appears in recent assistant messages
function isSignificantTermInAssistantHistory(
  terms: string[],
  history: HistoryMessage[]
): boolean {
  if (terms.length === 0) return false;
  const recentAssistant = history
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return terms.some((t) => recentAssistant.includes(t.toLowerCase()));
}

// ── Helper: multi-pattern refusal detection (Correção 3C) ────────────────────
// Detects refusals regardless of exact phrasing (LLM may paraphrase).

const REFUSAL_PATTERNS = [
  "não faz parte do foco do iattom assist",
  "fora do foco do iattom",
  "fora do escopo do iattom",
  "não está relacionado ao iattom",
  "não está no foco do iattom",
  "posso ajudar com negócios, vendas, marketing",
  "esse assunto não faz parte",
  "esse tema não faz parte",
  "está fora do meu foco",
  "não é meu foco",
];

function lastResponseWasRefusal(history: HistoryMessage[]): boolean {
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;
  const lower = lastAssistant.content.toLowerCase();
  return REFUSAL_PATTERNS.some((p) => lower.includes(p));
}

// ── Helper: detect user contesting / requesting clarification (Correção 3C) ──

const CONTESTING_RE =
  /\b(não sabe|não consegue|não entende|explicar?|o que (é|significa|quer dizer|quis dizer|se refere)|essa palavra|esse termo|esses termos|que palavra|que termo|palavra técnica|técnica que|se refere|referência|quis dizer|quer dizer|pode explicar|me explica|me explicar|explica isso|explica esse|explica essa|você falou|você disse|você usou|você mencionou|o que você quis|você não sabe)\b/i;

function isContestingRefusal(query: string): boolean {
  return CONTESTING_RE.test(query.trim());
}

// ── Override prompts — injected when protections fire (Correção 3B) ──────────
// Explicitly overrides Rule 4 so the LLM doesn't produce the same refusal.

function buildTermContextOverridePrompt(
  terms: string[],
  history: HistoryMessage[]
): string {
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
    .join("\n\n");

  const termList = terms.length > 0 ? `"${terms.join('", "')}"` : "mencionado anteriormente";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OVERRIDE OBRIGATÓRIO — IGNORE A REGRA 4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O termo ${termList} aparece no histórico da conversa.
O usuário está pedindo para você explicar esse termo ou referência.
NÃO diga que está fora do foco. NÃO aplique a Regra 4.
Explique o termo com base no contexto da conversa e na sua área de conhecimento em negócios digitais.
Se o termo for técnico e não relacionado ao IAttom Assist, explique-o brevemente e conecte ao contexto do usuário.

Histórico recente:
${recentHistory}`;
}

// ── Near-domain contextual reasoning — no keyword match but valid domain ─────
// Used when the query is inside the IAttom ecosystem but no entry scored.
// Gives the LLM full reasoning freedom within the domain.
// Prevents generic platform-overview dump; instead asks LLM to reason or
// ask ONE clarifying question when it genuinely needs more context.
function buildContextualReasoningPrompt(history: HistoryMessage[]): string {
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
    .join("\n\n");

  const historyBlock = recentHistory
    ? `\nHistórico recente:\n${recentHistory}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — RACIOCÍNIO CONTEXTUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A pergunta do usuário está dentro do ecossistema de negócios digitais, vendas ou uso do IAttom Assist, mas não há contexto específico disponível no banco de conhecimento.

FAÇA — NESTA ORDEM:
1. Se o contexto do usuário mostrar GARGALO IDENTIFICADO: comece pelo gargalo. Não pule para ferramenta ou plataforma.
2. Identifique o estágio do usuário (começo, validação, campanha, publicação, integração) e oriente o próximo passo lógico.
3. Se houver restrições acumuladas (sem aparecer + sem estoque + sem conteúdo + capital limitado): identifique se a combinação elimina a maioria dos caminhos — e diga isso antes de recomendar qualquer coisa.
4. Se a pergunta for sobre ganhar dinheiro ou monetizar: identifique o que o usuário tem e o que lhe falta — ajuste a recomendação ao perfil real, não ao perfil ideal.
5. Se genuinamente precisar de mais contexto: faça UMA pergunta curta — ex: "Você já tem um produto definido?"

ORDEM OBRIGATÓRIA DE RESPOSTA:
Gargalo real → estratégia → próximo passo → ferramenta (se aplicável)

NÃO FAÇA:
- Não liste todos os módulos da plataforma como resposta.
- Não responda com um menu genérico de funcionalidades.
- Não ignore restrições declaradas — elas definem o que é viável.
- Não diga que está "fora do foco" — a pergunta está dentro do ecossistema.
- Não invente funcionalidades, preços ou fluxos específicos do IAttom que não estejam confirmados.${historyBlock}`;
}

// ── INTEGRATION_PURPOSE prompt — benefit-first, zero technical jargon ────────
function buildIntegrationPurposePrompt(context: string): string {
  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — FINALIDADE DE INTEGRAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário está perguntando a FINALIDADE, o BENEFÍCIO ou o OBJETIVO de uma integração.

RESPONDA explicando:
- Por que essa integração existe dentro do IAttom.
- Qual o benefício prático: o IAttom encurta o caminho entre ter uma ideia/produto e preparar o material para publicar, anunciar ou divulgar na plataforma externa.
- Onde se encaixa no fluxo do usuário: encontrar produto → validar → preparar oferta/anúncio → publicar/divulgar.
- Linguagem simples, orientada ao resultado. Sem jargão técnico.

PROIBIDO NESTA RESPOSTA (só mencionar se o usuário perguntar diretamente sobre configuração):
- OAuth, autenticação, login com conta externa, credenciais
- Webhook, endpoint, callback, token, API
- Roadmap, disponível em breve, ainda não disponível
- Rota /dashboard/..., nome de módulo interno (Criar Campanha, Criar Conteúdo, Gerador Criativo)
- Status técnico da integração, integração indisponível
- Lista técnica de funcionalidades
- Qualquer sigla ou framework inventado (MITS, MITs, MIT, etc.)

CONTEXTO DO IATTOM ASSIST:
${context}`;
}

// ── P2: ADVISOR_MODE — mentor/partner prompt ─────────────────────────────────
// Triggered when user explicitly asks for a recommendation as if the AI were a partner.
// Strategy before modules. Never list modules first.

function buildAdvisorModePrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — MODO CONSULTOR / SÓCIO ESTRATÉGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer sua opinião direta e recomendação concreta — como se você fosse um sócio experiente com quem ele conversa.

RESPONDA COMO MENTOR E CONSULTOR:
1. Verifique primeiro: há restrições acumuladas no contexto do usuário? Se houver GARGALO IDENTIFICADO — comece por ele antes de qualquer coisa.
2. Identifique o objetivo real com base no que o usuário compartilhou.
3. Avalie o estágio atual: está começando do zero, validando, ou já tem negócio ativo?
4. Identifique riscos do caminho atual ou da pergunta — o que pode dar errado?
5. Se as restrições do usuário eliminam a maioria dos caminhos: diga isso diretamente e ofereça o único caminho viável.
6. Dê uma recomendação concreta e direta. Tome uma posição. Não seja vago.
7. Explique brevemente o raciocínio por trás da recomendação.
8. Termine com um próximo passo concreto.
9. Módulos e funcionalidades do IAttom: mencione apenas no final, como ferramentas de execução — nunca como a resposta principal.

ORDEM DA RESPOSTA (OBRIGATÓRIA):
Gargalo ou erro estratégico → estratégia → próximo passo → ferramenta (se aplicável)

PROIBIDO NESTA RESPOSTA:
- Começar listando módulos da plataforma.
- Ignorar restrições acumuladas e responder como se elas não existissem.
- Dar respostas vagas como "depende de cada caso" sem tomar posição.
- Apresentar um menu de opções sem uma recomendação clara.
- Perguntar mais de uma coisa ao usuário (se precisar, faça UMA pergunta específica).

Se não houver informação suficiente sobre o objetivo do usuário: faça UMA pergunta direta antes de recomendar.${contextSection}${recentHistoryBlock}`;
}

// ── FASE 3 BLOCO 2: PRIORITIZATION_MODE — eliminate → rank → justify → decide ──
// Triggered when user has multiple options and needs to know what to tackle first,
// what to drop, or how to order their focus.
// Framework: 6 criteria — capital, time-to-revenue, complexity, risk, scalability, reversibility.

function buildPrioritizationPrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — PRIORIZAÇÃO E RANQUEAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário tem múltiplas opções e precisa saber qual atacar primeiro, qual abandonar ou como ordenar o foco.

REGRA DE AÇÃO IMEDIATA — LEIA ANTES DE QUALQUER COISA:
Se a pergunta do usuário contiver QUALQUER um dos seguintes elementos, RESPONDA IMEDIATAMENTE — não peça contexto antes:
— Restrições declaradas (capital, tempo, habilidade): "R$500", "pouco tempo", "pouco dinheiro", "sem experiência"
— Opções mencionadas: "Shopee, Mercado Livre ou Hotmart", "curso ou produto físico", "três opções"
— Comparação explícita: "qual primeiro", "qual abandono", "onde foco"
Se houver dados suficientes para montar um ranking inicial → MONTE o ranking agora. Peça refinamento no final, nunca antes.
Só peça esclarecimento ANTES de responder quando as opções forem completamente indefinidas e sem elas nenhum ranking seja possível — ex: "tenho 10 ideias" sem listar as ideias.

PROTOCOLO OBRIGATÓRIO — EXECUTE ESTA SEQUÊNCIA:

PASSO 1 — ELIMINAÇÃO:
Antes de ranquear qualquer opção, identifique o que é incompatível com as restrições reais do usuário:
— Capital insuficiente para o modelo exigido?
— Tempo insuficiente para o ciclo de retorno?
— Competência ausente sem como compensar?
— Dependência externa que o usuário não controla?
Essas opções saem do ranking antes de começar. Explique por que foram eliminadas.

PASSO 2 — APLICAR OS 6 CRITÉRIOS:
Para cada opção restante, avalie:
1. Capital necessário — quanto exige para começar e para chegar ao retorno?
2. Tempo para primeira receita — em semanas ou meses, quanto leva para gerar o primeiro resultado financeiro?
3. Complexidade de execução — quantos passos dependem de terceiros, habilidades novas ou aprovações externas?
4. Risco de fracasso — qual a probabilidade de não funcionar mesmo com execução correta?
5. Escalabilidade — se funcionar, dá para crescer sem depender de mais tempo ou capital proporcionalmente?
6. Reversibilidade — se não funcionar, o custo (tempo, dinheiro, reputação) é recuperável?

PASSO 3 — RANKING:
Ordene as opções do mais ao menos prioritário para a SITUAÇÃO REAL DO USUÁRIO.
Use linguagem clara: "em primeiro lugar...", "em segundo lugar...", "deixaria por último porque..."
O ranking deve refletir os critérios aplicados — não intuição genérica.

PASSO 4 — DECISÃO E ABERTURA PARA REFINAMENTO:
Diga qual atacaria primeiro e por quê — em uma frase direta.
"Atacaria X primeiro porque [critério principal que justifica a prioridade]."
Se quiser, encerre com: "Se seu objetivo for diferente de [X], posso ajustar o ranking."

ESTRUTURA DA RESPOSTA:
1. O que eliminou e por quê (se houver eliminação)
2. Ranking das opções restantes com justificativa breve por critério
3. Qual atacar primeiro — decisão direta
4. Convite a refinamento (opcional, no final)

PROIBIDO NESTA RESPOSTA:
- Perguntar "qual seu objetivo?" quando já existem opções, restrições ou comparações na pergunta
- Responder "depende" sem concluir com um ranking e uma decisão
- Listar opções sem ordená-las
- Aplicar os critérios sem chegar a uma conclusão
- Terminar sem dizer qual o primeiro passo concreto
- Apresentar todos os caminhos como igualmente válidos — eles não são${contextSection}${recentHistoryBlock}`;
}

// ── FASE 3 BLOCO 2: DECISION_MODE — take position, name choice, trade-off ──────
// Triggered when user asks what to choose, what would you pick, or which option.
// Distinct from COMPARE_OPTIONS (neutral comparison) — this is about a decisive answer.

function buildDecisionModePrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — DECISÃO DIRETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer que você ESCOLHA — não que você compare. Tome uma posição. Dê uma decisão.

REGRA DE AÇÃO IMEDIATA — LEIA ANTES DE QUALQUER COISA:
Se a pergunta do usuário contiver opções explícitas, restrições declaradas (capital, tempo, habilidade) ou uma comparação direta — TOME POSIÇÃO IMEDIATAMENTE.
Não peça contexto antes de responder. Decida com o que há. Se precisar de refinamento, peça depois.
Exemplos de quando decidir imediatamente:
— "Tenho R$500. Shopee, Mercado Livre ou Hotmart?" → há orçamento + opções → decida agora
— "Produto físico ou digital?" → há duas opções → tome posição agora
— "Pouco tempo e pouco dinheiro. Onde foco?" → há restrições → decida agora
Só peça esclarecimento ANTES de responder quando não houver NENHUMA opção identificável e sem ela a decisão seria pura adivinhação.

PROTOCOLO OBRIGATÓRIO:

PASSO 1 — TOME POSIÇÃO:
Escolha uma opção. Nomeie explicitamente: "escolheria X", "tomaria o caminho Y", "ficaria com Z".
Não seja neutro quando houver opções ou restrições suficientes para decidir.
Use o que há: budget declarado, restrições, opções mencionadas, histórico da sessão.
Se o contexto for genuinamente insuficiente (sem opções identificáveis): faça UMA pergunta específica.

PASSO 2 — JUSTIFIQUE A ESCOLHA:
Explique o motivo real da escolha — não uma lista de vantagens genéricas.
O motivo deve se conectar diretamente ao contexto do usuário (restrições, objetivo, estágio).

PASSO 3 — MOSTRE O TRADE-OFF:
Toda decisão tem custo. Mostre:
— O que se ganha com a escolha feita
— O que se perde (ou deixa de ter) ao escolher essa opção
— O custo oculto: o que não é imediato mas vai aparecer depois

PASSO 4 — EXPLIQUE POR QUE NÃO AS DEMAIS:
Para cada opção não escolhida, diga em uma frase por que não escolheu.
Formato: "Não escolheria Y porque [razão específica ao contexto do usuário]."
Se quiser, encerre com: "Se seu objetivo mudar para [X], a escolha poderia ser diferente."

ESTRUTURA DA RESPOSTA:
1. A escolha — nomeada diretamente na primeira frase
2. Por que essa escolha — conectada ao contexto real (budget, restrições, opções)
3. Trade-off — o que se ganha, o que se perde, custo oculto
4. Por que não as outras — uma frase por opção rejeitada
5. Convite a refinamento (opcional, no final)

PROIBIDO NESTA RESPOSTA:
- Perguntar "qual seu objetivo?" quando já há opções ou restrições na pergunta
- Responder sem nomear uma escolha quando há opções identificáveis
- Apresentar as opções como equivalentes sem tomar posição
- Terminar com "depende do seu perfil" sem antes ter dado a decisão
- Listar vantagens de cada opção sem concluir qual vence${contextSection}${recentHistoryBlock}`;
}

// ── FASE 3 BLOCO 3: ECONOMIC_REASONING_MODE — qualitative economic framework ──
// Triggered when user asks about return, payback, risk-return, opportunity cost,
// or compares two paths from a financial lens. No exact numbers invented.
// Protocol: resources → return → risk → time-to-revenue → opportunity cost → conclude.

function buildEconomicReasoningPrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — ANÁLISE ECONÔMICA CONSULTIVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer saber qual caminho ou investimento tem melhor retorno, menor risco ou recuperação mais rápida.

REGRA DE AÇÃO IMEDIATA — LEIA ANTES DE QUALQUER COISA:
Se a pergunta contiver opções explícitas, restrições declaradas (capital, tempo, habilidade) ou comparação financeira — INICIE A ANÁLISE AGORA.
Não peça contexto antes de responder. Use o que há. Peça refinamento no final.
Exemplos:
— "Tenho R$500. Shopee ou Hotmart?" → há budget + opções → analise agora
— "Vale gastar 3 meses criando um curso?" → há restrição de tempo + ação concreta → analise agora
— "Estoque ou tráfego com R$1.000?" → há budget + opções → analise agora
Só peça esclarecimento antes quando não houver NENHUMA informação econômica identificável.

FRAMEWORK ECONÔMICO — APLIQUE PARA CADA OPÇÃO:

[1] CAPITAL NECESSÁRIO
Quanto exige para começar? Existe custo variável relevante (estoque, anúncio, ferramenta)?
Classifique: baixo / médio / alto

[2] TEMPO PARA PRIMEIRA RECEITA (PAYBACK)
Classifique em uma das três faixas:
→ RÁPIDO: dias a semanas (ex: marketplace com produto pronto, afiliado com lista existente)
→ MÉDIO: 1 a 3 meses (ex: afiliado orgânico, pequeno tráfego pago)
→ LENTO: 3 meses ou mais (ex: curso do zero, produto próprio sem audiência)
Não invente números exatos. Use as faixas acima.

[3] RISCO FINANCEIRO
Qual a probabilidade de perder o capital investido sem retorno?
Classifique: baixo / médio / alto
Nomeie o risco concreto: estoque encalhado? anúncio que não converte? curso que ninguém compra?

[4] ESCALABILIDADE
Se funcionar, dá para crescer sem precisar de capital proporcional adicional?
Classifique: baixa / média / alta

[5] COMPLEXIDADE OPERACIONAL
Quantas dependências externas, habilidades novas ou aprovações o modelo exige?
Classifique: baixa / média / alta

[6] CUSTO DE OPORTUNIDADE
O que o usuário DEIXA DE GANHAR ao escolher este caminho em vez do alternativo?
Sempre nomear. Exemplo: "Ao escolher curso, você deixa de ter receita nos próximos 3 meses que o afiliado poderia gerar."
Este é o custo que não aparece na conta — mas é real.

PROTOCOLO OBRIGATÓRIO — EXECUTE ESTA SEQUÊNCIA:

PASSO 1 — RECURSOS DISPONÍVEIS:
Identifique o que o usuário declarou: capital, tempo, habilidade, audiência existente.
Use o que foi declarado. Se nada foi declarado, use o perfil típico de quem está começando.

PASSO 2 — ANÁLISE DO RETORNO ESPERADO:
Para cada opção, aplique o framework acima (6 eixos).
Use linguagem direta: "retorno alto, payback lento" — não listas de vantagens genéricas.

PASSO 3 — ANÁLISE DO RISCO:
Qual o risco concreto de cada opção? O que precisa dar certo para o retorno acontecer?
Nomeie o pior cenário realista de cada caminho.

PASSO 4 — TEMPO PARA RESULTADO:
Classifique cada opção: RÁPIDO / MÉDIO / LENTO.
O usuário precisa saber quando vai ver o primeiro resultado — não apenas se vai funcionar.

PASSO 5 — CUSTO DE OPORTUNIDADE:
Para a opção que você vai recomendar: o que o usuário abre mão ao escolhê-la?
Para as opções rejeitadas: o que elas custariam em termos de capital, tempo e risco?

PASSO 6 — RECOMENDAÇÃO DIRETA:
Nomeie o caminho com melhor risco-retorno para o perfil do usuário.
Use linguagem direta: "O melhor risco-retorno aqui é X porque..."
Se quiser, encerre com: "Se o objetivo mudar para [Y], o cálculo muda. Me conta e refino."

ESTRUTURA DA RESPOSTA:
1. Análise econômica de cada opção (6 eixos — formato conciso, não lista extensa)
2. Custo de oportunidade de cada caminho
3. Recomendação direta — caminho com melhor risco-retorno
4. Convite a refinamento (opcional, no final)

PROIBIDO NESTA RESPOSTA:
- Inventar números específicos de receita, percentual de conversão ou ROI exato
- Responder "depende" sem concluir com uma recomendação
- Comparar opções sem nomear qual tem melhor risco-retorno
- Omitir o custo de oportunidade — ele é parte central da análise
- Terminar sem dizer qual caminho recomenda para o contexto declarado${contextSection}${recentHistoryBlock}`;
}

// ── FASE 3: PRE_MORTEM_MODE — adversarial failure analysis ────────────────────
// Triggered when user asks where a plan fails, what risks exist, or declares
// a risky action. Protocol: assume failure → work backwards → find causes.
// Distinct from WHAT_NOT_TO_DO (forward-looking) — this is backward-looking.

function buildPreMortemPrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — ANÁLISE ADVERSARIAL / PRE-MORTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer saber onde um plano, ideia ou ação pode falhar — ou declarou uma ação com risco implícito.

PROTOCOLO OBRIGATÓRIO — EXECUTE ESTA SEQUÊNCIA ANTES DE RESPONDER:

PASSO 1 — ASSUMIR FALHA:
Não avalie se vai funcionar. Assuma que já falhou. Sua tarefa é identificar POR QUÊ falhou.

PASSO 2 — INVESTIGAR AS CAUSAS PROVÁVEIS:
Examine cada dimensão:
— Dependências: o que precisa ser verdadeiro para funcionar e pode não ser?
— Gargalos: onde o fluxo trava se um elo quebrar?
— Premissas frágeis: o que o usuário está assumindo sem ter validado?
— Pontos cegos: o que provavelmente não foi considerado?
— Risco financeiro: onde o capital pode ser esgotado antes do retorno?
— Timing: a sequência de execução cria alguma dependência perigosa?

PASSO 3 — RANKEAR POR PROBABILIDADE:
A causa mais provável de falha vem primeiro. Não liste riscos em ordem aleatória.
Use linguagem de probabilidade: "o risco mais provável é...", "o segundo risco relevante é..."

PASSO 4 — SÓ ENTÃO: o que verificar ou corrigir ANTES de avançar.
Nunca inverta essa ordem. Correções antes da análise de risco produzem otimismo falso.

ESTRUTURA DA RESPOSTA:
1. Causa mais provável de falha — e por quê é a mais provável
2. Segunda causa relevante (se existir no contexto do usuário)
3. O que verificar ou corrigir antes de avançar

PROIBIDO NESTA RESPOSTA:
- Começar com incentivo ("boa ideia!", "faz sentido", "está no caminho certo")
- Assumir que o plano é bom ou razoável
- Listar riscos genéricos desconectados do contexto real do usuário
- Sugerir correções antes de explicar as causas de falha
- Terminar sem indicar qual verificação é mais urgente
- Usar lista de riscos sem rankear por probabilidade${contextSection}${recentHistoryBlock}`;
}

// ── P2: PREMISE_CHALLENGE — verify prerequisites before answering ─────────────
// Triggered when user asks if they should do X. Checks if X makes sense first.

function buildPremiseChallengePrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — DESAFIO DE PREMISSA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário está perguntando se deve fazer X. ANTES de responder "como fazer", verifique se as condições para X estão presentes.

PROCESSO OBRIGATÓRIO:
1. Identifique o que está sendo proposto (criar campanha, conectar plataforma, lançar produto, investir, etc.).
2. Verifique os pré-requisitos: o produto está validado? O público está definido? A oferta está clara? O momento é certo?
3. Se os pré-requisitos NÃO estão presentes: diga isso primeiro e explique o que falta. Só então redirecione.
4. Se os pré-requisitos ESTÃO presentes: responda SIM ou NÃO com justificativa concisa e objetivo.
5. Termine sempre com o próximo passo correto — nunca deixe o usuário sem saída.

EXEMPLOS DO QUE EVITAR:
- Responder "como criar a campanha" sem verificar se o produto existe e foi validado.
- Dizer "sim, conecte tudo" sem verificar se há produto ou objetivo definido.
- Dar um passo a passo técnico sem antes avaliar se a premissa faz sentido.${contextSection}${recentHistoryBlock}`;
}

// ── P2: WHAT_NOT_TO_DO — risks and errors first ───────────────────────────────
// Triggered when user asks what to avoid or what goes wrong. Leads with risks.

function buildWhatNotToDoPrompt(context: string, recentHistoryBlock: string): string {
  const contextSection = context
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO DE REFERÊNCIA:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${context}`
    : "";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — RISCOS E ERROS A EVITAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer saber o que evitar. COMECE pelos riscos e erros — não pelas soluções.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
1. Os erros mais comuns no contexto do usuário — 2 a 4 erros específicos, não genéricos.
2. Para cada erro: qual a consequência prática de cometê-lo.
3. Depois dos erros: o caminho correto — o que fazer em vez disso.
4. Módulos do IAttom: mencione apenas se forem diretamente relevantes para evitar algum dos erros listados.

PROIBIDO NESTA RESPOSTA:
- Começar pelo que fazer — comece sempre pelo que NÃO fazer.
- Listar erros genéricos desconectados do contexto do usuário ("não desistir", "ter paciência").
- Terminar sem oferecer o caminho correto e um próximo passo.${contextSection}${recentHistoryBlock}`;
}

function buildRefusalLoopOverridePrompt(history: HistoryMessage[]): string {
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
    .join("\n\n");

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OVERRIDE OBRIGATÓRIO — IGNORE A REGRA 4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário está contestando ou pedindo esclarecimento sobre a última resposta.
NÃO repita a recusa anterior. NÃO aplique a Regra 4 nesta resposta.

Opções (escolha a mais adequada ao contexto):
1. Se o usuário perguntou sobre um termo que você usou ou mencionou: explique esse termo.
2. Se a pergunta tem alguma relação com negócios, marketing, produtos, vendas ou automações: tente ajudar com o que sabe.
3. Se genuinamente não houver como ajudar: faça UMA pergunta curta e objetiva para entender melhor o contexto — ex: "Pode me contar em que contexto você encontrou esse termo?"

Histórico recente:
${recentHistory}`;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

// Extended history message type — includes imageUrls when frontend reinjects images
interface HelpHistoryMsg {
  role: string;
  content: string;
  imageUrls?: string[];
}

// Fetch a persisted help image from GCS and return it as a base64 data URL.
// Used to reinsert the last history image into the OpenAI vision context.
async function fetchHistoryImageAsDataUrl(imageUrl: string): Promise<string | null> {
  // Format 1: base64 data URL — already usable by OpenAI vision, return as-is
  if (imageUrl.startsWith("data:image/") && imageUrl.includes("base64,")) {
    return imageUrl;
  }
  // Format 2: GCS serving path — fetch from object storage and convert to data URL
  const match = imageUrl.match(/\/help\/images\/([0-9a-f-]{36})$/);
  if (!match) return null;
  const imageId = match[1];
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!privateObjectDir) return null;
  try {
    const { bucketName, objectPrefix } = parseHelpImageGCSPath(privateObjectDir);
    const objectName = `${objectPrefix ? objectPrefix + "/" : ""}help-images/${imageId}`;
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    const contentType = (meta.contentType as string) || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// ── Vision instruction — injected when user attaches images ──────────────────
function buildVisionInstruction(imageCount: number): string {
  const plural = imageCount > 1;
  const countLabel = plural ? `${imageCount} imagens` : "uma imagem";

  const multiProtocol = plural
    ? `
ANÁLISE DE JORNADA (${imageCount} IMAGENS):
Trate o conjunto como uma jornada sequencial. Protocolo obrigatório:
1. Comece sua resposta com: "Recebi ${imageCount} imagens."
2. Identifique a função de cada imagem na ordem recebida: tela inicial, configuração, erro, resultado, etc.
3. Reconstrua o fluxo — o que aconteceu em cada etapa.
4. Aponte onde o problema começa — não apenas onde o erro aparece.
5. Explique a relação entre as imagens: como uma leva à seguinte.
6. Se a sequência não estiver clara: informe — "Analisei as imagens na ordem enviada, mas alguns prints podem estar fora de sequência."

Prioridade de organização:
— Ordem enviada pelo usuário (sempre a base)
— Numeração visível na imagem
— Horário visível na captura
— Continuidade visual da tela
— Continuidade do texto entre imagens
— Relação entre erro, tela anterior e tela seguinte
`
    : "";

  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DE ${plural ? `${imageCount} IMAGENS` : "IMAGEM"} (INSTRUÇÃO ATIVA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário enviou ${countLabel} junto com a mensagem.
${multiProtocol}
PRIORIDADE ABSOLUTA — MARCAÇÕES MANUAIS DO USUÁRIO:
Antes de qualquer outra análise, verifique se há na${plural ? "s imagens" : " imagem"}:
— Círculos ou elipses desenhados sobre a tela
— Setas ou indicadores de direção
— Áreas destacadas (amarelo, vermelho, outra cor)
— Áreas riscadas ou tachadas
— Anotações de texto sobrepostas
— Qualquer elemento visual que aponte para uma região específica

Se existirem marcações: analise EXCLUSIVAMENTE essas áreas em primeiro lugar.
A marcação é a intenção visual explícita do usuário — é mais importante que qualquer outro elemento.
Nunca ignore marcações. Nunca inicie pela análise geral antes de tratar as marcações.

Em cada imagem, identifique também:
— Mensagens de erro ou avisos
— Campos de configuração, tokens, webhooks, URLs, credenciais
— Status de integração, badges, labels, indicadores
— Fluxos de tela, dashboards, formulários, modais
— Qualquer texto legível${plural ? "\n— Continuidade ou ruptura em relação à imagem anterior" : ""}

Protocolo obrigatório:
1. Se houver marcações: comece por elas. Descreva o que está marcado e o que isso indica.
2. Identifique o problema ou situação com base no que está visível.
3. Forneça diagnóstico preciso combinando ${plural ? "imagens" : "imagem"} + texto do usuário.
4. Sugira ações concretas e sequenciais para resolver.
5. Se ${plural ? "as imagens" : "a imagem"} não ${plural ? "contiverem" : "contiver"} contexto suficiente: informe o que está faltando.
6. Nunca afirme que não consegue ver ${plural ? "as imagens" : "a imagem"} — analise o que for possível.
7. Nunca invente informações que não aparecem nas imagens.

Se o histórico imediato mostrar que o tipo de análise já foi confirmado (o usuário já respondeu o que quer ${plural ? "das imagens" : "da imagem"}), inicie a análise diretamente — não repita a pergunta de confirmação.`;
}

router.post("/help/chat", requireAuth, async (req, res): Promise<void> => {
  // Abort signal — terminates the OpenAI stream when the client disconnects
  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const { message, history, images } = req.body as {
    message?: string;
    history?: HelpHistoryMsg[];
    /** Array of base64 data URLs, max 10. Single-image compat: also accepts imageBase64. */
    images?: string[];
    imageBase64?: string; // legacy single-image field — still accepted
  };

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "message é obrigatório." });
    return;
  }

  // Support both new `images[]` and legacy `imageBase64` field
  const rawImages: string[] = Array.isArray((req.body as { images?: string[] }).images)
    ? (req.body as { images: string[] }).images
    : typeof (req.body as { imageBase64?: string }).imageBase64 === "string"
      ? [(req.body as { imageBase64: string }).imageBase64]
      : [];

  // Validate each image: must be a data URL, image type, under 6MB, max 10 items
  const validImages = rawImages
    .slice(0, 10)
    .filter(
      (img) =>
        typeof img === "string" &&
        img.startsWith("data:image/") &&
        img.includes(";base64,") &&
        img.length < 8_000_000,
    );

  const hasImages = validImages.length > 0;

  // rawHistory preserves imageUrls for last-image reinsertion into OpenAI context.
  // conversationHistory strips imageUrls — used for intent detection, context extraction.
  const rawHistory: HelpHistoryMsg[] = Array.isArray(history) ? history.slice(-6) : [];
  const conversationHistory: HistoryMessage[] = rawHistory.map((m) => ({
    role: (m.role === "user" || m.role === "assistant" ? m.role : "user") as "user" | "assistant",
    content: m.content,
  }));

  // ── [HELP DEBUG] Payload recebido ─────────────────────────────────────────
  req.log.info({ msg: "[HELP DEBUG] rawHistory received", count: rawHistory.length, imageUrlsPerMsg: rawHistory.map((m) => ({ role: m.role, imageUrls: m.imageUrls ?? null })) });
  // ──────────────────────────────────────────────────────────────────────────

  // ── Continuation detection ────────────────────────────────────────────────
  const isContinuation = detectContinuation(message);
  const lastAssistantContent =
    conversationHistory
      .filter((m) => m.role === "assistant")
      .slice(-1)[0]?.content ?? "";

  // ── P1: Extract intra-session user context from history ────────────────────
  const sessionUserCtx = extractUserContext(conversationHistory);
  const sessionUserCtxBlock = formatUserContext(sessionUserCtx);

  // ── Retrieval ──────────────────────────────────────────────────────────────
  let { context: relevantContext, outOfScope, intent, nearDomain } = getRelevantContext(
    message,
    conversationHistory
  );

  // ── Correção 3: Context + refusal loop protections ────────────────────────

  // Extract significant terms from query (siglas ≥2 UPPERCASE, words ≥6 non-stopword)
  const significantTerms = extractSignificantTerms(message);

  // Bloco 7 (improved): term used by assistant OR user is asking about a term
  const termInHistory = isSignificantTermInAssistantHistory(significantTerms, conversationHistory);
  const askingAboutTerm = isAskingAboutTerm(message);
  const isTermContext = outOfScope && (termInHistory || (askingAboutTerm && conversationHistory.length > 0));

  // Bloco 8 (improved): last response was refusal AND user is contesting it
  const wasRefusal = lastResponseWasRefusal(conversationHistory);
  const isContesting = isContestingRefusal(message);
  const isRefusalLoop = outOfScope && wasRefusal && (isContesting || askingAboutTerm);

  // ── Shared: recent history block for consultive prompts ───────────────────
  const recentHistoryBlock =
    conversationHistory.length > 0
      ? `\n\nHistórico recente:\n${conversationHistory
          .slice(-4)
          .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
          .join("\n\n")}`
      : "";

  // ── Build system prompt ────────────────────────────────────────────────────
  let systemWithContext: string;

  if (isContinuation && lastAssistantContent) {
    // Continuation takes highest priority
    systemWithContext = buildContinuationPrompt(lastAssistantContent);
  } else if (isTermContext) {
    // Correção 3B: explicit override — do NOT apply Rule 4, explain the term
    systemWithContext = buildTermContextOverridePrompt(significantTerms, conversationHistory);
  } else if (isRefusalLoop) {
    // Correção 3C: explicit override — do NOT repeat the refusal
    systemWithContext = buildRefusalLoopOverridePrompt(conversationHistory);
  } else if (intent === "ADVISOR_MODE" && !outOfScope) {
    // P2: Mentor/partner mode — strategy before modules
    systemWithContext = buildAdvisorModePrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "DECISION_MODE" && !outOfScope) {
    // FASE 3 BLOCO 2: Take position, name choice, show trade-offs, explain why not others
    systemWithContext = buildDecisionModePrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "ECONOMIC_REASONING_MODE" && !outOfScope) {
    // FASE 3 BLOCO 3: Qualitative economic analysis — payback, risk-return, opportunity cost
    systemWithContext = buildEconomicReasoningPrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "WHAT_NOT_TO_DO" && !outOfScope) {
    // P2: Risks-first — errors and consequences before solutions
    systemWithContext = buildWhatNotToDoPrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "PRIORITIZATION_MODE" && !outOfScope) {
    // FASE 3 BLOCO 2: Eliminate → rank by 6 criteria → justify → decide first
    systemWithContext = buildPrioritizationPrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "PRE_MORTEM_MODE" && !outOfScope) {
    // FASE 3: Adversarial failure analysis — assume failure, work backwards
    systemWithContext = buildPreMortemPrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "PREMISE_CHALLENGE" && !outOfScope) {
    // P2: Verify prerequisites before validating the user's proposed action
    systemWithContext = buildPremiseChallengePrompt(relevantContext, recentHistoryBlock);
  } else if (intent === "INTEGRATION_PURPOSE" && !outOfScope && relevantContext) {
    // Benefit-first response — technical details explicitly suppressed
    systemWithContext = buildIntegrationPurposePrompt(relevantContext);
  } else if (outOfScope) {
    // Genuinely outside the IAttom ecosystem
    systemWithContext = OUT_OF_SCOPE_INSTRUCTION;
  } else if (nearDomain) {
    // Domain query with no keyword match — allow contextual reasoning, no generic dump
    systemWithContext = buildContextualReasoningPrompt(conversationHistory);
  } else if (relevantContext) {
    systemWithContext = `${SYSTEM_PROMPT}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO OFICIAL DISPONÍVEL:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${relevantContext}`;
  } else {
    // Safety net — should rarely be reached after nearDomain covers domain queries
    systemWithContext = buildContextualReasoningPrompt(conversationHistory);
  }

  // ── P1: Inject accumulated user context into all prompts ──────────────────
  // Appended last so it is always visible regardless of which prompt was chosen.
  if (sessionUserCtxBlock) {
    systemWithContext += sessionUserCtxBlock;
  }

  // ── Vision: inject image analysis instruction when images are attached ───────
  if (hasImages) {
    systemWithContext += buildVisionInstruction(validImages.length);
  }

  setupSSE(res);
  sendSSE(res, { type: "start" });

  // ── Build the user content — text-only or text + images ──────────────────
  type MsgContent =
    | string
    | Array<
        | { type: "image_url"; image_url: { url: string; detail: "auto" } }
        | { type: "text"; text: string }
      >;

  const userContent: MsgContent = hasImages
    ? [
        ...validImages.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img, detail: "auto" as const },
        })),
        { type: "text" as const, text: semanticNormalize(message) },
      ]
    : semanticNormalize(message);

  // ── History image reinsertion ──────────────────────────────────────────────
  // Locate the last user message in rawHistory that carries imageUrls.
  // Fetch those images from GCS so OpenAI vision can see them again.
  // Only the LAST such message is reinjected — all others remain text-only.
  const lastHistoryImgMsg = [...rawHistory].reverse().find(
    (m) => m.role === "user" && Array.isArray(m.imageUrls) && (m.imageUrls?.length ?? 0) > 0,
  );

  // ── [HELP DEBUG] lastHistoryImgMsg selecionado ────────────────────────────
  req.log.info({ msg: "[HELP DEBUG] lastHistoryImgMsg", found: !!lastHistoryImgMsg, imageUrls: lastHistoryImgMsg?.imageUrls ?? null });
  // ──────────────────────────────────────────────────────────────────────────

  let historyImgContent: Array<{ type: "image_url"; image_url: { url: string; detail: "auto" } }> = [];
  if (lastHistoryImgMsg?.imageUrls && lastHistoryImgMsg.imageUrls.length > 0) {
    const fetchResults = await Promise.all(
      lastHistoryImgMsg.imageUrls.map(async (url) => {
        const result = await fetchHistoryImageAsDataUrl(url);
        req.log.info({ msg: "[HELP DEBUG] fetchHistoryImageAsDataUrl", url, success: !!result });
        return result;
      }),
    );
    historyImgContent = fetchResults
      .filter((u): u is string => !!u)
      .map((url) => ({ type: "image_url" as const, image_url: { url, detail: "auto" as const } }));
  }

  // ── [HELP DEBUG] historyImgContent reconstruído ───────────────────────────
  req.log.info({ msg: "[HELP DEBUG] rebuilt history images count", count: historyImgContent.length });
  // ──────────────────────────────────────────────────────────────────────────

  try {
    // Build messages array.
    // — History user messages: semanticNormalize applied; last image message reinserted as multimodal.
    // — Current user message: text-only or text+images (existing logic).
    // Cast to unknown first — the OpenAI SDK union requires exact role literals
    // that TypeScript can't narrow through the mixed array literal.
    const messages = [
      { role: "system" as const, content: systemWithContext },
      ...rawHistory.map((m) => {
        const isLastImg = m === lastHistoryImgMsg && historyImgContent.length > 0;
        if (isLastImg) {
          return {
            role: m.role as "user" | "assistant",
            content: [
              ...historyImgContent,
              { type: "text" as const, text: semanticNormalize(m.content) },
            ],
          };
        }
        return {
          role: m.role as "user" | "assistant",
          content: m.role === "user" ? semanticNormalize(m.content) : m.content,
        };
      }),
      { role: "user" as const, content: userContent },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as unknown as Parameters<typeof openai.chat.completions.create>[0]["messages"];

    // ── [HELP DEBUG] Resumo final das messages para OpenAI ──────────────────
    req.log.info({
      msg: "[HELP DEBUG] final OpenAI messages summary",
      total: messages.length,
      summary: (messages as Array<{ role: string; content: unknown }>).map((m) => ({
        role: m.role,
        contentType: Array.isArray(m.content) ? "multimodal" : "text",
        imageCount: Array.isArray(m.content)
          ? (m.content as Array<{ type: string }>).filter((p) => p.type === "image_url").length
          : 0,
      })),
    });
    // ────────────────────────────────────────────────────────────────────────

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages,
      stream: true,
    }, { signal: ac.signal });

    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        sendSSE(res, { type: "chunk", content });
        chunkCount++;
      }
    }

    // P3: Smart fallback — retry with simplified contextual reasoning prompt
    // before giving up. Covers empty responses from complex system prompts
    // (reasoning-heavy models may exhaust visible token budget on first pass).
    if (chunkCount === 0) {
      req.log.warn({ msg: "Empty LLM response, retrying with simplified prompt", intent, path: req.path });
      try {
        const retryMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: buildContextualReasoningPrompt(conversationHistory) + sessionUserCtxBlock },
          { role: "user", content: semanticNormalize(message) },
        ];
        const retryStream = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 1024,
          messages: retryMessages,
          stream: true,
        });
        for await (const chunk of retryStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            sendSSE(res, { type: "chunk", content });
            chunkCount++;
          }
        }
      } catch {
        // retry also failed — fall through to error below
      }
    }

    if (chunkCount === 0) {
      req.log.warn({ msg: "LLM returned empty after retry", intent, path: req.path });
      sendSSEError(
        res,
        "Não consegui processar essa resposta agora. Tente reformular a pergunta ou me conte seu objetivo."
      );
      return;
    }
  } catch {
    sendSSEError(
      res,
      "O IAttom Help está temporariamente indisponível. Tente novamente em alguns instantes."
    );
    return;
  }

  sendSSEDone(res);
});

// ── History: load ─────────────────────────────────────────────────────────────

router.get("/help/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  try {
    const rows = await db
      .select()
      .from(helpMessages)
      .where(eq(helpMessages.clerkUserId, userId))
      .orderBy(asc(helpMessages.createdAt))
      .limit(100);

    res.json(rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      imageUrls: r.imageUrls
        ? (JSON.parse(r.imageUrls) as string[])
        : undefined,
    })));
  } catch {
    req.log.error({ msg: "Error loading help history", userId });
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

// ── History: save exchange ────────────────────────────────────────────────────

router.post("/help/save", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { userMessage, assistantMessage, imageUrls } = req.body as {
    userMessage?: string;
    assistantMessage?: string;
    imageUrls?: string[];
  };

  if (
    !userMessage || typeof userMessage !== "string" ||
    !assistantMessage || typeof assistantMessage !== "string"
  ) {
    res.status(400).json({ error: "userMessage e assistantMessage são obrigatórios." });
    return;
  }

  const imageUrlsJson =
    Array.isArray(imageUrls) && imageUrls.length > 0
      ? JSON.stringify(imageUrls)
      : null;

  try {
    await db.insert(helpMessages).values([
      { clerkUserId: userId, role: "user",      content: userMessage.trim(), imageUrls: imageUrlsJson },
      { clerkUserId: userId, role: "assistant", content: assistantMessage.trim() },
    ]);
    res.json({ ok: true });
  } catch {
    req.log.error({ msg: "Error saving help messages", userId });
    res.status(500).json({ error: "Erro ao salvar mensagem." });
  }
});

// ── History: clear ────────────────────────────────────────────────────────────

router.delete("/help/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  try {
    await db.delete(helpMessages).where(eq(helpMessages.clerkUserId, userId));
    res.json({ ok: true });
  } catch {
    req.log.error({ msg: "Error clearing help history", userId });
    res.status(500).json({ error: "Erro ao limpar histórico." });
  }
});

export default router;
