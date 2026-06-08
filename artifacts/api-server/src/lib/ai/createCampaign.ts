import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";

interface CreateCampaignInput {
  product: string;
  audience?: string;
  goal?: string;
  mode?: string;
  platforms?: string[];
  budget?: string;
  productType?: string;
}

interface CampaignPlatformField {
  key: string;
  label: string;
  value: string;
}

interface CampaignCreativeBriefing {
  produto: string;
  plataforma: string;
  tipo_produto: string;
  objetivo: string;
  promessa: string;
  dor: string;
  beneficio: string;
  tom: string;
  cta: string;
  ideia_visual: string;
  restricoes: string;
}

export interface CampaignResult {
  campaignTitle?: string;
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  channels: string[];
  budget: string;
  copy: Record<string, string>;
  keyMessages: string[];
  launchTimeline: string;
  uniqueAngle: string;
  objectionHandling: string;
  platform?: string;
  platformFields?: CampaignPlatformField[];
  creativeBriefing?: CampaignCreativeBriefing;
}

function detectGoalPlatform(goal?: string): string {
  if (!goal) return "generic";
  const lower = goal.toLowerCase();
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("tiktok")) return "tiktok";
  if (lower.includes("facebook")) return "facebook";
  if (lower.includes("shopee")) return "shopee";
  if (lower.includes("mercado livre")) return "mercado_livre";
  if (lower.includes("hotmart")) return "hotmart";
  if (lower.includes("kiwify")) return "kiwify";
  return "generic";
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS POR PLATAFORMA — fixos e completos
// A IA preenche SOMENTE os campos aqui definidos. Nenhum campo extra permitido.
// ─────────────────────────────────────────────────────────────────────────────

function buildPlatformFieldsSpec(platform: string): string {
  switch (platform) {

    // ── MERCADO LIVRE ──────────────────────────────────────────────────────
    case "mercado_livre":
      return `"platformFields": [
    {
      "key": "titulo",
      "label": "Título do Anúncio",
      "value": string — OBRIGATÓRIO. Máx 60 chars. Palavras-chave de maior volume de busca no início, nome do produto, diferencial principal. Ex: "Garrafa Térmica Aço Inox 1L Frio 24h — Tampa Hermética"
    },
    {
      "key": "categoria",
      "label": "Categoria Sugerida",
      "value": string — categoria exata do Mercado Livre para este produto, usando o formato "Categoria > Subcategoria". Ex: "Esportes e Fitness > Hidratação > Garrafas"
    },
    {
      "key": "caracteristicas_tecnicas",
      "label": "Características Técnicas",
      "value": string — especificações do produto, uma por linha (\\n). REGRA CRÍTICA: inclua APENAS os dados que o usuário forneceu explicitamente. Para qualquer dado não informado (peso, voltagem, material, dimensões, garantia, capacidade etc.), escreva "Não informado" naquela linha. NUNCA invente especificações. Ex para "Geladeira Duplex 375L": "Capacidade: 375L\\nTipo: Duplex\\nVoltagem: Não informado\\nPeso: Não informado\\nDimensões: Não informado\\nClassificação energética: Não informado"
    },
    {
      "key": "beneficios_principais",
      "label": "Benefícios Principais",
      "value": string — 4 a 6 benefícios reais e tangíveis do produto para o comprador, um por linha (\\n). Foco em resultado de uso, não em características técnicas repetidas.
    },
    {
      "key": "diferenciais",
      "label": "Diferenciais do Produto",
      "value": string — o que diferencia este produto dos concorrentes diretos no Mercado Livre. Máx 200 chars. Objetivo: justificar a escolha deste anúncio frente a similares.
    },
    {
      "key": "descricao_curta",
      "label": "Descrição Curta",
      "value": string — máx 150 chars. Resumo direto do produto: o que é, para que serve e principal benefício. Aparece no preview do anúncio.
    },
    {
      "key": "descricao_completa",
      "label": "Descrição Completa",
      "value": string — descrição detalhada do produto. Inclua: o que é, para quem é, como usar, especificações, o que vem na embalagem, perguntas comuns já respondidas. Tom: informativo, direto, sem jargão publicitário. Mín 200 chars.
    },
    {
      "key": "perguntas_frequentes",
      "label": "Perguntas Frequentes",
      "value": string — 3 a 5 pares P: / R: separados por \\n\\n. Baseie-se nas dúvidas mais comuns de compradores deste tipo de produto no Mercado Livre. Ex: "P: Cabe em porta-copos de carro?\\nR: Sim, diâmetro de 7cm, compatível com a maioria dos porta-copos."
    }
  ]`;

    // ── SHOPEE ─────────────────────────────────────────────────────────────
    case "shopee":
      return `"platformFields": [
    {
      "key": "nome_anuncio",
      "label": "Nome do Anúncio",
      "value": string — OBRIGATÓRIO. Máx 120 chars. Palavras-chave de busca interna Shopee no início, modelo do produto, especificação principal, variação se houver. Ex: "Garrafa Térmica Aço Inox 1L Frio 24h Anti-Vazamento Tampa Rosca"
    },
    {
      "key": "categoria",
      "label": "Categoria Sugerida",
      "value": string — categoria Shopee mais adequada. Ex: "Casa e Vida > Cozinha > Garrafas e Copos"
    },
    {
      "key": "descricao_produto",
      "label": "Descrição do Produto",
      "value": string — descrição completa para a página do produto na Shopee. REGRA CRÍTICA: inclua SOMENTE informações fornecidas pelo usuário + benefícios genéricos de uso. NUNCA invente materiais, especificações técnicas, componentes, dimensões, conteúdo da embalagem ou dados não mencionados pelo usuário. Tom: claro e descritivo. Mín 200 chars.
    },
    {
      "key": "beneficios_principais",
      "label": "Benefícios Principais",
      "value": string — 4 a 6 benefícios reais para o comprador, um por linha (\\n). Ex: "Mantém bebidas geladas por 24 horas\\nTampa hermética — sem vazamentos na mochila"
    },
    {
      "key": "diferenciais",
      "label": "Diferenciais do Produto",
      "value": string — máx 200 chars. O que diferencia este produto dos concorrentes na Shopee. Pode incluir: qualidade do material, avaliações, custo-benefício, entrega rápida.
    },
    {
      "key": "palavras_chave",
      "label": "Palavras-chave de Busca",
      "value": string — 8 a 12 termos de busca relevantes para este produto na Shopee, separados por vírgula. Inclua variações de escrita e termos relacionados. Ex: "garrafa térmica, squeeze inox, garrafa de inox, garrafa sport, copo térmico"
    },
    {
      "key": "variacoes",
      "label": "Variações",
      "value": string — REGRA CRÍTICA: liste APENAS variações que o usuário mencionou explicitamente (cores, tamanhos, numerações, kits). NUNCA invente variações. Se o usuário informou alguma variação, liste-a. Se não informou nada: escrever exatamente "Variações: Não informado pelo usuário — preencher com os dados reais do produto"
    },
    {
      "key": "perguntas_frequentes",
      "label": "Perguntas Frequentes",
      "value": string — 3 a 5 pares P: / R: separados por \\n\\n. Baseie-se nas dúvidas mais comuns de compradores Shopee deste tipo de produto.
    }
  ]`;

    // ── HOTMART ────────────────────────────────────────────────────────────
    case "hotmart":
      return `"platformFields": [
    {
      "key": "nome_produto",
      "label": "Nome do Produto",
      "value": string — nome claro, vendável e memorável do produto digital. Deve comunicar o resultado ou transformação. Ex: "Método Vendas Automáticas 2.0" ou "Inglês Fluente em 90 Dias"
    },
    {
      "key": "headline",
      "label": "Headline da Página de Vendas",
      "value": string — OBRIGATÓRIO. Máx 80 chars. Promessa de transformação clara, específica e crível. Foco no resultado que o aluno vai alcançar. Evite promessas impossíveis.
    },
    {
      "key": "subheadline",
      "label": "Subheadline",
      "value": string — OBRIGATÓRIO. Máx 120 chars. Complementa a headline: para quem é, como entrega, resultado concreto esperado.
    },
    {
      "key": "descricao_curta",
      "label": "Descrição Curta da Oferta",
      "value": string — máx 200 chars. Resumo da proposta de valor: o que é o produto, para quem é e por que comprar agora. Usar no topo da página de vendas.
    },
    {
      "key": "descricao_completa",
      "label": "Descrição Completa da Oferta",
      "value": string — copy principal da página de vendas. Estrutura recomendada: problema → agitação → solução → diferencial → prova social → oferta. Tom: empático, direto e persuasivo. Mín 300 chars.
    },
    {
      "key": "beneficios",
      "label": "Benefícios",
      "value": string — 4 a 6 benefícios concretos que o aluno vai obter, um por linha (\\n). Foco em transformação real e resultado tangível — não em o que o curso "tem", mas no que o aluno vai "conseguir".
    },
    {
      "key": "conteudo_produto",
      "label": "Conteúdo do Produto",
      "value": string — GRUPO B: se o usuário informou os módulos reais, liste-os diretamente. Se não informou, gere estrutura de curso inteligente baseada no tema, prefixada com "Estrutura Recomendada:\\n". Ex sem dados reais: "Estrutura Recomendada:\\n- Módulo 1: Fundamentos\\n- Módulo 2: Prática\\n- Módulo 3: Resultados"
    },
    {
      "key": "bonus",
      "label": "Bônus Recomendados",
      "value": string — GRUPO B: se o usuário informou os bônus reais, liste-os diretamente. Se não informou, sugira 2 a 3 bônus estratégicos relevantes para o tema, prefixados com "Bônus Recomendados:\\n". Ex: "Bônus Recomendados:\\n- Planilha de acompanhamento\\n- Comunidade de suporte"
    },
    {
      "key": "garantia",
      "label": "Garantia",
      "value": string — GRUPO A: se o usuário informou o prazo real, use diretamente. Se não informou: escrever "Garantia Recomendada: utilizar a garantia mínima exigida pela plataforma (7 dias — conforme CDC)."
    },
    {
      "key": "cta",
      "label": "CTA de Compra",
      "value": string — OBRIGATÓRIO. Máx 50 chars. Texto do botão de compra. Ex: "Quero acesso agora", "Garantir minha vaga", "Começar com desconto hoje"
    }
  ]`;

    // ── KIWIFY ─────────────────────────────────────────────────────────────
    case "kiwify":
      return `"platformFields": [
    {
      "key": "nome_produto",
      "label": "Nome do Produto",
      "value": string — nome direto e vendável do produto digital. Comunica o resultado ou entrega principal. Evite nomes genéricos.
    },
    {
      "key": "headline",
      "label": "Headline da Página de Vendas",
      "value": string — OBRIGATÓRIO. Máx 80 chars. Oferta direta e benefício principal. Sem fluff. Ex: "Aprenda a fechar clientes pelo WhatsApp em 7 dias — ou não paga nada"
    },
    {
      "key": "subheadline",
      "label": "Subheadline",
      "value": string — OBRIGATÓRIO. Máx 120 chars. Valor entregue e para quem é, em uma frase densa e acionável.
    },
    {
      "key": "descricao_curta",
      "label": "Descrição Curta da Oferta",
      "value": string — máx 200 chars. Entrega imediata, principal promessa e chamada para ação. Tom direto e sem rodeios.
    },
    {
      "key": "descricao_completa",
      "label": "Descrição Completa da Oferta",
      "value": string — copy da página de vendas Kiwify. Estrutura: dor → solução → prova → oferta. Mais curta e direta que Hotmart — Kiwify converte com páginas enxutas. Mín 200 chars.
    },
    {
      "key": "beneficios",
      "label": "Benefícios",
      "value": string — 4 a 6 benefícios concretos separados por \\n. Foco em resultado imediato e entrega tangível.
    },
    {
      "key": "conteudo_produto",
      "label": "Conteúdo do Produto",
      "value": string — GRUPO B: se o usuário informou os módulos reais, liste-os diretamente. Se não informou, gere estrutura de curso enxuta e direta baseada no tema, prefixada com "Estrutura Recomendada:\\n". Ex: "Estrutura Recomendada:\\n- Módulo 1: Base\\n- Módulo 2: Aplicação\\n- Módulo 3: Escala"
    },
    {
      "key": "bonus",
      "label": "Bônus Recomendados",
      "value": string — GRUPO B: se o usuário informou os bônus reais, liste-os diretamente. Se não informou, sugira 1 a 2 bônus relevantes e diretos, prefixados com "Bônus Recomendados:\\n".
    },
    {
      "key": "garantia",
      "label": "Garantia",
      "value": string — GRUPO A: se o usuário informou o prazo real, use diretamente. Se não informou: escrever "Garantia Recomendada: utilizar a garantia mínima exigida pela plataforma (7 dias — conforme CDC)."
    },
    {
      "key": "cta",
      "label": "CTA de Compra",
      "value": string — OBRIGATÓRIO. Máx 50 chars. Ex: "Acesse por apenas R$X", "Comprar agora", "Garantir acesso com desconto"
    }
  ]`;

    // ── FACEBOOK ───────────────────────────────────────────────────────────
    case "facebook":
      return `"platformFields": [
    {
      "key": "texto_principal",
      "label": "Texto Principal",
      "value": string — OBRIGATÓRIO. Máx 600 chars. Copy do post ou anúncio no feed do Facebook. Estrutura: gancho (problema ou dado surpreendente) → argumento de valor → prova social → CTA. Tom: adulto, direto, sem jargão corporativo.
    },
    {
      "key": "headline",
      "label": "Headline",
      "value": string — OBRIGATÓRIO. Máx 40 chars. Linha de impacto que aparece em negrito abaixo da imagem no anúncio. Benefício central, imediato.
    },
    {
      "key": "descricao_curta",
      "label": "Descrição Curta",
      "value": string — máx 30 chars. Reforço da oferta ou do CTA. Aparece abaixo da headline. Ex: "Acesso imediato garantido", "Entrega em até 3 dias"
    },
    {
      "key": "cta",
      "label": "Botão CTA",
      "value": string — OBRIGATÓRIO. Máx 30 chars. Texto do botão de ação. Ex: "Comprar agora", "Saiba mais", "Inscreva-se", "Enviar mensagem"
    },
    {
      "key": "sugestao_criativo",
      "label": "Criativo Recomendado",
      "value": string — recomendação concreta para o visual (foto, vídeo ou carrossel): o que mostrar, ângulo visual, texto sobreposto (se houver), formato ideal para o objetivo. Max 200 chars.
    }
  ]`;

    // ── INSTAGRAM ──────────────────────────────────────────────────────────
    case "instagram":
      return `"platformFields": [
    {
      "key": "legenda",
      "label": "Legenda",
      "value": string — OBRIGATÓRIO. Máx 450 chars. Copy completo da publicação no feed ou Reels. Estrutura: 1ª frase para parar o scroll → desenvolvimento autêntico → CTA claro. Tom: próximo, real, sem excesso de emojis.
    },
    {
      "key": "primeira_frase",
      "label": "Primeira Frase de Impacto",
      "value": string — OBRIGATÓRIO. Máx 90 chars (aparece antes do "ver mais"). Deve gerar curiosidade, contraste ou identificação imediata. Esta frase decide se o usuário vai ler o resto.
    },
    {
      "key": "cta",
      "label": "CTA",
      "value": string — OBRIGATÓRIO. Máx 60 chars. Ação clara e específica. Ex: "Comente QUERO e te mando o link", "Salve esse post para não esquecer", "Me segue para mais dicas assim"
    },
    {
      "key": "hashtags",
      "label": "Hashtags",
      "value": string — 5 a 7 hashtags relevantes separados por espaço, sem # na resposta. Misture hashtags de volume alto, médio e nicho. Ex: "empreendedorismo vendasonline marketingdigital negociosonline estrategiadevenda"
    },
    {
      "key": "sugestao_criativo",
      "label": "Criativo Recomendado",
      "value": string — recomendação concreta para o visual: tipo de conteúdo (Reels, carrossel, foto única), o que mostrar, formato, texto em tela (se houver). Max 200 chars.
    }
  ]`;

    // ── TIKTOK ─────────────────────────────────────────────────────────────
    case "tiktok":
      return `"platformFields": [
    {
      "key": "gancho",
      "label": "Gancho Inicial (primeiros 2 segundos)",
      "value": string — OBRIGATÓRIO. Máx 80 chars. Frase ou pergunta que para o scroll imediatamente. Deve gerar curiosidade, contraste ou provocação. Ex: "Você tá perdendo dinheiro fazendo isso todo dia" ou "90% dos vendedores erram nesse detalhe"
    },
    {
      "key": "roteiro",
      "label": "Roteiro do Vídeo",
      "value": string — OBRIGATÓRIO. Roteiro narrativo do vídeo em blocos: Gancho (2s) → Desenvolvimento (30-40s) → Resolução/CTA (5-10s). Inclua o que o criador deve dizer em cada momento. Máx 400 chars.
    },
    {
      "key": "legenda",
      "label": "Legenda do Vídeo",
      "value": string — OBRIGATÓRIO. Máx 150 chars. Texto que aparece na legenda do TikTok. Deve complementar o vídeo, não repetir. Pode incluir o CTA escrito.
    },
    {
      "key": "cta",
      "label": "CTA",
      "value": string — OBRIGATÓRIO. Máx 60 chars. Ação oral (o que o criador fala no final) e/ou em tela. Ex: "Segue pra ver mais dicas assim", "Comenta QUERO que te mando o link"
    },
    {
      "key": "hashtags",
      "label": "Hashtags",
      "value": string — 3 a 7 hashtags TikTok relevantes separados por espaço, sem # na resposta. Priorize hashtags de nicho e tendência, não as genéricas.
    },
    {
      "key": "sugestao_criativo",
      "label": "Vídeo Recomendado",
      "value": string — recomendação concreta para o formato e estilo do vídeo: câmera (selfie, estúdio, tela), ritmo de edição, música recomendada (tipo/estilo), texto em tela. Max 200 chars.
    }
  ]`;

    // ── GENÉRICO (fallback) ────────────────────────────────────────────────
    default:
      return `"platformFields": [
    {
      "key": "copy_principal",
      "label": "Copy Principal",
      "value": string — OBRIGATÓRIO. Máx 500 chars. Copy direto e acionável para o objetivo informado.
    },
    {
      "key": "cta",
      "label": "CTA",
      "value": string — OBRIGATÓRIO. Máx 50 chars. Ação clara e direta.
    }
  ]`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DO BRIEFING CRIATIVO — campo interno, discreto
// ─────────────────────────────────────────────────────────────────────────────

const CREATIVE_BRIEFING_SCHEMA = `"creativeBriefing": {
    "produto": string (nome completo do produto ou marca),
    "plataforma": string (chave da plataforma: mercado_livre/shopee/hotmart/kiwify/facebook/instagram/tiktok),
    "tipo_produto": string (Digital/Físico/Serviço — conforme informado pelo usuário ou inferido),
    "objetivo": string (objetivo específico da campanha em 1 frase),
    "promessa": string (promessa principal de valor — resultado concreto que o produto entrega),
    "dor": string (dor ou problema principal que o produto resolve),
    "beneficio": string (principal benefício tangível para o público),
    "tom": string (tom de voz desta entrega: ex "informativo e direto", "empático e persuasivo", "autêntico e próximo"),
    "cta": string (CTA principal desta entrega),
    "ideia_visual": string (sugestão de conceito visual para comunicação: imagem, vídeo ou criativo),
    "restricoes": string (restrições relevantes ou "Nenhuma")
  }`;

// ─────────────────────────────────────────────────────────────────────────────
// PROIBIÇÕES EXPLÍCITAS POR PLATAFORMA
// ─────────────────────────────────────────────────────────────────────────────

function buildPlatformProhibitions(platform: string): string {
  switch (platform) {
    case "mercado_livre":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Legenda de rede social
- Hashtags
- "Comente", "Salve", "Siga" (CTAs de redes sociais)
- Headline de página de vendas (estilo Hotmart/Kiwify)
- Bônus de produto digital
- Garantia de devolução estilo infoproduto
- Público-alvo publicitário (persona de ads)
- Campos de copy de anúncio pago (Facebook Ads, Google Ads)
- Estrutura de página de vendas`;

    case "shopee":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Legenda de rede social
- Hashtags de redes sociais
- "Comente", "Salve", "Siga" (CTAs de redes sociais)
- Headline de página de vendas (estilo Hotmart/Kiwify)
- Bônus de produto digital
- Garantia de devolução estilo infoproduto
- Público-alvo publicitário (persona de ads)
- Campos de copy de anúncio pago`;

    case "hotmart":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Hashtags
- Legenda de rede social
- "Comente", "Salve", "Siga"
- Título de anúncio de marketplace (estilo ML/Shopee)
- Categoria de produto (ML/Shopee)
- Características técnicas físicas de produto (peso, dimensões, material)
- Palavras-chave de busca de marketplace
- FAQ estilo marketplace
- Sugestão de variações de produto físico`;

    case "kiwify":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Hashtags
- Legenda de rede social
- "Comente", "Salve", "Siga"
- Título de anúncio de marketplace
- Categoria de produto (ML/Shopee)
- Características técnicas de produto físico
- Palavras-chave de busca de marketplace
- FAQ estilo marketplace
- Sugestão de variações de produto físico`;

    case "facebook":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Título de anúncio de marketplace (formato ML/Shopee)
- Categoria de produto para marketplace
- Características técnicas longas (especificações de produto físico)
- Bônus e garantia de infoproduto (exceto se o produto for explicitamente digital)
- Estrutura completa de página de vendas (Hotmart/Kiwify)
- Hashtags de Instagram ou TikTok
- FAQ de marketplace`;

    case "instagram":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Título de anúncio de marketplace
- Categoria de produto para marketplace
- Palavras-chave de busca de marketplace
- Descrição completa estilo Mercado Livre ou Shopee
- FAQ de marketplace
- Estrutura de página de vendas (Hotmart/Kiwify)
- Bônus e garantia de infoproduto (exceto se o produto for digital)
- Características técnicas longas`;

    case "tiktok":
      return `CAMPOS PROIBIDOS NESTA PLATAFORMA — não gerar, não incluir, não mencionar:
- Título de anúncio de marketplace
- Descrição longa estilo Mercado Livre ou Shopee
- Categoria de produto para marketplace
- FAQ de marketplace
- Estrutura completa de página de vendas
- Bônus e garantia de infoproduto (exceto se o produto for explicitamente digital)
- Campos de Hotmart/Kiwify (headline de VSL, conteúdo do produto, etc.)`;

    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZAÇÃO ORGÂNICA — somente para Instagram/TikTok em modo orgânico
// ─────────────────────────────────────────────────────────────────────────────

const PAID_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bFacebook\s*Ads\b/gi, "postagem no Facebook"],
  [/\bMeta\s*Ads\b/gi, "conteúdo orgânico"],
  [/\bInstagram\s*Ads\b/gi, "Reels orgânicos"],
  [/\bGoogle\s*(Search\s*)?Ads\b/gi, "SEO orgânico"],
  [/\bTikTok\s*Ads\b/gi, "TikTok orgânico"],
  [/\bROAS\b/gi, "retorno orgânico"],
  [/\bCPC\b/gi, "engajamento"],
  [/\bCPM\b/gi, "alcance orgânico"],
  [/\bCPA\b/gi, "conversão orgânica"],
  [/\bretargeting\b/gi, "reengajamento orgânico"],
  [/\bremarketing\b/gi, "reconexão com audiência"],
  [/\blookalike\b/gi, "público semelhante orgânico"],
  [/\bpixel\b/gi, "engajamento"],
  [/\bmídia\s*paga\b/gi, "conteúdo orgânico"],
  [/\btráfego\s*pago\b/gi, "tráfego orgânico"],
  [/\bcampanha\s*paga\b/gi, "estratégia orgânica"],
  [/\bimpulsionar\b/gi, "publicar organicamente"],
  [/\bads\b/gi, "conteúdo orgânico"],
];

function sanitizeOrganicText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PAID_TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function hardLockOrganicFields(fields: CampaignPlatformField[]): CampaignPlatformField[] {
  return fields.map((f) => ({ ...f, value: sanitizeOrganicText(f.value) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const BASE_RULES = `IDIOMA: Responda SEMPRE em português brasileiro. Nunca em inglês ou espanhol.

ARQUITETURA DE ENTREGA — REGRA ABSOLUTA:
Você é um especialista em marketing digital para o mercado brasileiro. Sua função é preencher um schema FIXO por plataforma.

A plataforma escolhida pelo usuário define TODOS os campos. Você não decide quais campos criar.
Você apenas preenche os campos já definidos no schema com conteúdo de alta qualidade.

NUNCA adicione campos extras fora do schema. NUNCA deixe campos em branco. NUNCA invente campos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMADA DE INTEGRIDADE DE DADOS — REGRA GLOBAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Todo campo pertence a um destes dois grupos:

GRUPO A — DADOS FACTUAIS (nunca inventar)
  São dados concretos e verificáveis do produto.
  Usar SOMENTE se o usuário informou. Se não informou: escrever "Não informado".
  Inclui: peso, potência, voltagem, capacidade, dimensões, material, tipo de tecido,
  tipo de sola, componentes internos, classificação energética, certificações,
  garantia contratual real, cores disponíveis, tamanhos disponíveis, numerações,
  conteúdo da embalagem, prazo de entrega, compatibilidade técnica,
  módulos reais existentes, quantidade real de aulas, duração real do curso,
  bônus reais contratados, certificado real.
  → Se ausente: "Não informado" — nunca estimar, nunca completar.

GRUPO B — CONTEÚDO ESTRATÉGICO (a IA deve sugerir)
  São campos de inteligência de marketing que a IA deve preencher com criatividade e estratégia.
  Inclui: headline, subheadline, promessa, posicionamento, avatar, dores, benefícios,
  CTA, diferenciais, copy, legenda, gancho, roteiro, estrutura sugerida de produto,
  módulos sugeridos, bônus sugeridos, esteira sugerida, oferta sugerida, palavras-chave,
  sugestão de criativo, perguntas frequentes baseadas no tipo de produto.
  → Gerar sempre com qualidade estratégica máxima.
  → Quando o campo for uma estrutura não confirmada pelo usuário,
     prefixar com: "Estrutura Recomendada:"

REGRA DE PREFIXAÇÃO PARA ESTRUTURAS RECOMENDADAS:
  Correto:   "Estrutura Recomendada:\n- Módulo 1: Fundamentos\n- Módulo 2: ..."
  Incorreto: "Módulo 1: Fundamentos\nMódulo 2: ..." (sem indicar que é recomendação)
  Esta regra se aplica SOMENTE a campos onde o usuário não forneceu o dado real.
  Se o usuário forneceu o dado, use diretamente sem prefixo.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTILO DE ESCRITA:
- Direto, denso, acionável — como consultor sênior
- Frases curtas (máximo 15 palavras quando possível)
- Verbos no imperativo quando aplicável
- Sem introduções, conclusões ou jargão corporativo
- Anti-repetição: ângulo único por campo, nunca repita argumentos entre campos

ANTI-REPETIÇÃO:
Nunca repita a mesma palavra-chave ou argumento entre campos diferentes.
Cada campo deve abordar um ângulo distinto do produto.

Saída: objeto JSON válido. Sem markdown, sem blocos de código, apenas JSON puro.`;

function buildSystemPrompt(platform: string, isOrganic: boolean): string {
  const platformFieldsSpec = buildPlatformFieldsSpec(platform);
  const prohibitions = buildPlatformProhibitions(platform);

  const modeNote = isOrganic
    ? `MODO ORGÂNICO — REGRA ADICIONAL:
Nenhum campo pode mencionar ou sugerir tráfego pago, ads, impulsionamento, orçamento de mídia, ROAS, CPC, CPM, lookalike, retargeting ou remarketing. Todo o conteúdo deve ser adequado para publicação orgânica.`
    : "";

  return `${BASE_RULES}

${modeNote}

${prohibitions}

SCHEMA OBRIGATÓRIO DA PLATAFORMA (preencha SOMENTE estes campos):
${platformFieldsSpec}

O JSON de saída deve conter EXATAMENTE esta estrutura:
{
  "platform": string (chave da plataforma em snake_case: mercado_livre/shopee/hotmart/kiwify/facebook/instagram/tiktok),
  ${platformFieldsSpec.replace(/\n/g, "\n  ")},
  ${CREATIVE_BRIEFING_SCHEMA}
}

Não adicione nenhuma chave fora desta estrutura.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING E VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function safeParseJson(raw: string): { success: true; data: unknown } | { success: false; error: string } {
  if (!raw?.trim()) return { success: false, error: "A IA retornou uma resposta vazia." };
  try { return { success: true, data: JSON.parse(raw.trim()) }; } catch { /* continue */ }
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return { success: true, data: JSON.parse(cleaned) }; } catch { /* continue */ }
  const cs = cleaned.indexOf("{");
  const ce = cleaned.lastIndexOf("}");
  if (cs !== -1 && ce !== -1 && ce > cs) {
    try { return { success: true, data: JSON.parse(cleaned.slice(cs, ce + 1)) }; } catch { /* continue */ }
  }
  const rs = raw.indexOf("{");
  const re = raw.lastIndexOf("}");
  if (rs !== -1 && re !== -1 && re > rs) {
    try { return { success: true, data: JSON.parse(raw.slice(rs, re + 1)) }; } catch { /* continue */ }
  }
  return { success: false, error: "Erro ao interpretar a resposta da IA. Tente novamente." };
}

function validateCampaignResult(r: CampaignResult): string | null {
  if (!r.platformFields || r.platformFields.length === 0) {
    return "Campos da plataforma não foram gerados.";
  }
  const hasValues = r.platformFields.some((f) => f.value?.trim());
  if (!hasValues) return "Os campos da plataforma não foram preenchidos.";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICAÇÃO ASSISTIDA — passo a passo por plataforma
// ─────────────────────────────────────────────────────────────────────────────

interface PlatformGuide {
  name: string;
  url: string;
  steps: string[];
  note: string;
}

function buildPublicationGuide(platform: string, fields: CampaignPlatformField[]): PlatformGuide | null {
  const get = (key: string) => fields.find((f) => f.key === key)?.value ?? "";

  switch (platform) {
    case "mercado_livre":
      return {
        name: "Mercado Livre",
        url: "https://www.mercadolivre.com.br",
        steps: [
          "Acesse mercadolivre.com.br e faça login como vendedor",
          "Vá em Meus Anúncios → Criar anúncio",
          `Cole o Título do Anúncio gerado: "${get("titulo").slice(0, 60)}"`,
          "Selecione a Categoria Sugerida no campo de categoria",
          "Preencha as Características Técnicas nos atributos do produto",
          "Cole a Descrição Completa no campo de descrição",
          "Adicione as Perguntas Frequentes manualmente via Central do Vendedor → FAQ",
          "Configure Produto Patrocinado em Publicidade para aumentar visibilidade",
          "Monitore visitas, cliques e conversões em Central do Vendedor → Meus Anúncios",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "shopee":
      return {
        name: "Shopee",
        url: "https://seller.shopee.com.br",
        steps: [
          "Acesse seller.shopee.com.br e faça login no Seller Centre",
          "Vá em Meus Produtos → Adicionar novo produto",
          `Cole o Nome do Anúncio gerado: "${get("nome_anuncio").slice(0, 120)}"`,
          "Selecione a Categoria Sugerida",
          "Cole a Descrição do Produto no campo de descrição",
          "Adicione as Palavras-chave de Busca nas tags do produto",
          "Configure as variações sugeridas se aplicável",
          "Ative Oferta Relâmpago e configure cupons em Marketing → Vouchers",
          "Acompanhe performance em Análise de Dados → Produtos",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "hotmart":
      return {
        name: "Hotmart",
        url: "https://app.hotmart.com",
        steps: [
          "Acesse app.hotmart.com e faça login na sua conta",
          "Vá em Meus Produtos → selecione o produto → Página de Vendas",
          `Defina o Nome do Produto: "${get("nome_produto")}"`,
          `Cole a Headline na seção principal da página: "${get("headline")}"`,
          "Cole a Descrição Completa no corpo da página de vendas",
          "Adicione os Benefícios em formato de lista de checkmarks",
          "Adicione o Conteúdo do Produto na seção 'O que está incluso'",
          "Configure os Bônus na seção dedicada a bônus",
          `Configure a Garantia: "${get("garantia").slice(0, 80)}"`,
          `Defina o botão de compra com o CTA: "${get("cta")}"`,
          "Configure o Programa de Afiliados em Afiliados → Configurações",
          "Acompanhe conversões em Relatórios → Vendas",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "kiwify":
      return {
        name: "Kiwify",
        url: "https://app.kiwify.com.br",
        steps: [
          "Acesse app.kiwify.com.br e faça login",
          "Selecione o produto → Configurações → Página de Vendas",
          `Defina o Nome do Produto: "${get("nome_produto")}"`,
          `Cole a Headline: "${get("headline")}"`,
          "Cole a Descrição Completa no corpo da página",
          "Configure os Benefícios em lista",
          "Adicione os Bônus na seção correspondente",
          `Configure a Garantia: "${get("garantia").slice(0, 80)}"`,
          `Defina o botão de compra: "${get("cta")}"`,
          "Ative o Programa de Afiliados em Afiliados → Configurações",
          "Monitore transações em Dashboard → Transações",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "facebook":
      return {
        name: "Facebook",
        url: "https://www.facebook.com",
        steps: [
          "Acesse sua página no Facebook e clique em Criar publicação",
          "Cole o Texto Principal no campo de publicação",
          "Para anúncio: acesse Meta Ads Manager → Criar anúncio",
          `Use a Headline "${get("headline")}" no campo de título do anúncio`,
          `Configure a Descrição Curta "${get("descricao_curta")}" no campo de descrição`,
          `Selecione o botão de CTA: "${get("cta")}"`,
          "Crie o criativo conforme o Criativo Recomendado gerado",
          "Configure o público-alvo, orçamento e veiculação",
          "Monitore resultados em Meta Ads Manager → Relatórios",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "instagram":
      return {
        name: "Instagram",
        url: "https://www.instagram.com",
        steps: [
          "Abra o Instagram → toque em + → Nova publicação ou Reel",
          "Escolha o formato conforme o Criativo Recomendado gerado",
          `Use a Primeira Frase de Impacto: "${get("primeira_frase").slice(0, 90)}"`,
          "Cole a Legenda completa no campo de legenda",
          "Adicione as Hashtags no final da legenda ou no primeiro comentário",
          `Finalize com o CTA: "${get("cta")}"`,
          "Para Stories: use o CTA como sticker de link ou caixa de pergunta",
          "Publique entre 18h e 21h para maior alcance orgânico",
          "Acompanhe os Insights da publicação após 24h",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    case "tiktok":
      return {
        name: "TikTok",
        url: "https://www.tiktok.com",
        steps: [
          "Abra o TikTok → toque em + → gravar ou importar vídeo",
          `Comece o vídeo com o Gancho nos primeiros 2 segundos: "${get("gancho").slice(0, 80)}"`,
          "Siga o Roteiro gerado para o desenvolvimento do vídeo",
          "Adicione legendas em tela com o texto-chave do roteiro",
          `Cole a Legenda gerada no campo de legenda do vídeo`,
          `Adicione as Hashtags na legenda`,
          `Finalize o vídeo com o CTA: "${get("cta")}"`,
          "Configure o som conforme o Vídeo Recomendado",
          "Publique e monitore retenção nos primeiros 30 minutos",
        ],
        note: "Publicação Assistida — orientações para publicação manual. Nenhuma ação automática é executada pela plataforma.",
      };

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAM PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export async function streamCreateCampaign(
  params: CreateCampaignInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);

  sendSSE(res, { type: "start" });

  const platform = detectGoalPlatform(params.goal);
  const isOrganic = (params.mode ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("organico");
  const systemPrompt = buildSystemPrompt(platform, isOrganic);

  const platformLabel: Record<string, string> = {
    mercado_livre: "Mercado Livre",
    shopee: "Shopee",
    hotmart: "Hotmart",
    kiwify: "Kiwify",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
  };

  // Classifica o que o usuário forneceu vs. o que não forneceu
  // para reforçar a camada de integridade de dados no user prompt
  const productWords = params.product.trim();
  const providedData = [
    `Nome/descrição do produto: "${productWords}" — USE SOMENTE estes dados como base de especificação`,
    params.productType ? `Tipo de produto: ${params.productType}` : null,
    params.audience ? `Público-alvo informado: ${params.audience}` : null,
    params.goal ? `Objetivo: ${params.goal}` : null,
    params.mode ? `Modo: ${params.mode}` : null,
  ].filter(Boolean).join("\n");

  const userPrompt = `Gere a entrega completa para a plataforma especificada.

DADOS FORNECIDOS PELO USUÁRIO (use SOMENTE estes como base factual):
${providedData}

PLATAFORMA: ${platformLabel[platform] ?? "Não especificada"}

CLASSIFICAÇÃO OBRIGATÓRIA ANTES DE GERAR:
- Dados técnicos que o usuário forneceu: extraia SOMENTE do texto acima
- Dados técnicos que o usuário NÃO forneceu: marcar como "Não informado" — NUNCA inventar
- Copy, benefícios de uso e posicionamento: pode criar livremente, desde que não invente especificações

REGRA ABSOLUTA: Preencha SOMENTE os campos do schema desta plataforma. Não adicione nenhum campo extra.
Para campos que exigem dados técnicos não fornecidos pelo usuário: escreva "Não informado" — nunca complete com suposições.
Responda integralmente em português brasileiro.`;

  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 5000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        stream: false,
      }, { signal });

      const rawText = response.choices[0]?.message?.content ?? "";
      const parsed = safeParseJson(rawText);
      if (!parsed.success) continue;

      const raw = parsed.data as CampaignResult;
      const validationError = validateCampaignResult(raw);
      if (validationError) continue;

      if (isOrganic && raw.platformFields) {
        raw.platformFields = hardLockOrganicFields(raw.platformFields);
      }

      sendSSE(res, { type: "result", data: raw });
      await logAiUsage({ clerkUserId, action: `Entrega criada: ${params.product} → ${platform}`, module: "campaign" });
      sendSSEDone(res);
      return;
    } catch {
      // transient error — retry
    }
  }

  sendSSEError(res, "Não foi possível gerar a entrega desta vez. Tente novamente.");
}

// ─────────────────────────────────────────────────────────────────────────────
// REFINAMENTO DE BLOCO
// ─────────────────────────────────────────────────────────────────────────────

export async function refineCampaignBlock(
  blockId: string,
  currentContent: string,
  instruction: string,
  campaignContext: string,
  clerkUserId: string,
): Promise<{ refinedContent: string } | { error: string }> {
  const systemPrompt = `Você é um especialista em marketing digital brasileiro. Refine APENAS o campo especificado de uma entrega existente, seguindo a instrução do usuário. Responda APENAS com o conteúdo refinado — sem explicações, sem markdown, sem JSON, sem prefixo. Respeite os limites de caracteres do campo original.`;

  const userPrompt = `Campo a refinar: ${blockId}
Conteúdo atual: ${currentContent}
Instrução: ${instruction}
Contexto: ${campaignContext}

Retorne APENAS o conteúdo refinado para este campo. Sem aspas envolvendo a resposta.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) return { error: "A IA não retornou conteúdo refinado." };
    await logAiUsage({ clerkUserId, action: `Campo refinado: ${blockId}`, module: "campaign" });
    return { refinedContent: raw.trim() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro no refinamento" };
  }
}
