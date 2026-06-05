import type { KnowledgeEntry } from "./index.js";

/**
 * Integration knowledge entries.
 *
 * Content rule: explain PURPOSE and BENEFIT for the end-user first.
 * Technical details (OAuth, webhook, roadmap, route) are omitted here —
 * the INTEGRATION_PURPOSE system-prompt overlay handles the filter when
 * the user asks about purpose. If the user explicitly asks about technical
 * configuration, the general system prompt governs that response.
 */

export const integrations: KnowledgeEntry[] = [
  {
    id: "integration-mercado-livre",
    category: "integrations",
    topic: "Mercado Livre",
    keywords: [
      "mercado livre",
      "meli",
      "ml integração",
      "vender no mercado livre",
      "integração mercado livre",
      "marketplace mercado livre",
      "para que serve mercado livre",
      "finalidade mercado livre",
      "como funciona mercado livre",
      "o que o mercado livre faz",
      "mercado livre dentro do iattom",
      "anunciar no mercado livre",
    ],
    status: "active",
    content: `O Mercado Livre dentro do IAttom existe para encurtar o caminho entre ter um produto e publicar um anúncio estruturado no marketplace.

A ideia é simples: você já tem um produto ou uma ideia de produto. O IAttom usa o contexto do Mercado Livre — tipo de produto, público-alvo, plataforma — para ajudar você a sair da fase de preparação mais rápido e com menos retrabalho.

Onde se encaixa no seu processo:
Escolher produto → preparar a oferta e o anúncio → publicar no Mercado Livre.

O IAttom atua principalmente na etapa de preparação: estrutura do anúncio, argumentos de venda, descrição do produto e materiais de divulgação para atrair compradores no marketplace.`,
    relatedTopics: ["create-campaign", "journey-physical-product"],
  },
  {
    id: "integration-shopee",
    category: "integrations",
    topic: "Shopee",
    keywords: [
      "shopee",
      "integração shopee",
      "loja shopee",
      "vender na shopee",
      "para que serve shopee",
      "finalidade shopee",
      "como funciona shopee",
      "o que a shopee faz",
      "shopee dentro do iattom",
      "anunciar na shopee",
    ],
    status: "active",
    content: `A Shopee dentro do IAttom existe para encurtar o caminho entre ter um produto e publicar um anúncio estruturado no marketplace.

Você já tem um produto ou ideia de produto. O IAttom usa o contexto da Shopee — tipo de produto, público, plataforma — para ajudar você a preparar o anúncio, a descrição e o material de venda mais rápido.

Onde se encaixa no seu processo:
Escolher produto → preparar a oferta e o anúncio → publicar na Shopee.

O IAttom atua na etapa de preparação: textos de venda, descrição do produto, argumentos de conversão e materiais para atrair compradores no marketplace.`,
    relatedTopics: ["create-campaign", "journey-physical-product"],
  },
  {
    id: "integration-tiktok",
    category: "integrations",
    topic: "TikTok",
    keywords: [
      "tiktok",
      "tik tok",
      "integração tiktok",
      "tiktok shop",
      "vídeo tiktok",
      "vender no tiktok",
      "para que serve tiktok",
      "finalidade tiktok",
      "como funciona tiktok",
      "o que o tiktok faz",
      "tiktok dentro do iattom",
      "conteúdo tiktok",
    ],
    status: "active",
    content: `O TikTok dentro do IAttom existe para acelerar a criação de conteúdos e anúncios voltados para atrair compradores.

Em vez de começar do zero a cada vídeo ou campanha, você usa o IAttom com o contexto do TikTok — produto, audiência, objetivo — para preparar scripts, textos e materiais criativos com mais velocidade.

Onde se encaixa no seu processo:
Definir produto → preparar conteúdo e anúncio → divulgar no TikTok para atrair compradores.

O IAttom atua na etapa de preparação: scripts de vídeo, textos de divulgação, copy de campanha e ideias de conteúdo orientadas a gerar venda.`,
    relatedTopics: ["create-campaign", "video-scripts"],
  },
  {
    id: "integration-hotmart",
    category: "integrations",
    topic: "Hotmart",
    keywords: [
      "hotmart",
      "integração hotmart",
      "produto digital hotmart",
      "curso hotmart",
      "infoproduto hotmart",
      "vender no hotmart",
      "para que serve hotmart",
      "finalidade hotmart",
      "como funciona hotmart",
      "o que a hotmart faz",
      "hotmart dentro do iattom",
    ],
    status: "active",
    content: `A Hotmart dentro do IAttom existe para encurtar o caminho entre criar um produto digital e preparar esse produto para venda.

O IAttom não publica diretamente na Hotmart — ele ajuda você a organizar a oferta, o conteúdo e os materiais que você vai levar para a plataforma. A ideia é chegar na Hotmart com mais pronto, menos retrabalho e uma estrutura de venda mais clara.

Onde se encaixa no seu processo:
Criar produto digital → preparar oferta, copy e materiais de venda → levar para a Hotmart.

O IAttom atua na etapa de preparação: estrutura da oferta, texto de venda, materiais de lançamento e conteúdo para divulgar o produto digital.`,
    relatedTopics: ["create-campaign", "journey-digital-product"],
  },
  {
    id: "integration-kiwify",
    category: "integrations",
    topic: "Kiwify",
    keywords: [
      "kiwify",
      "integração kiwify",
      "produto digital kiwify",
      "vender no kiwify",
      "para que serve kiwify",
      "finalidade kiwify",
      "como funciona kiwify",
      "o que a kiwify faz",
      "kiwify dentro do iattom",
    ],
    status: "active",
    content: `A Kiwify dentro do IAttom existe para encurtar o caminho entre criar um produto digital e preparar esse produto para venda.

O IAttom não publica diretamente na Kiwify — ele ajuda você a organizar a oferta, o conteúdo e os materiais que você vai levar para a plataforma. A ideia é chegar na Kiwify com mais pronto e uma estrutura de venda mais clara.

Onde se encaixa no seu processo:
Criar produto digital → preparar oferta, copy e materiais de venda → levar para a Kiwify.

O IAttom atua na etapa de preparação: estrutura da oferta, texto de venda, materiais de lançamento e conteúdo para divulgar o produto digital.`,
    relatedTopics: ["create-campaign", "journey-digital-product"],
  },
  {
    id: "integration-facebook",
    category: "integrations",
    topic: "Facebook",
    keywords: [
      "facebook",
      "fb",
      "meta",
      "integração facebook",
      "facebook ads",
      "facebook business",
      "anúncio facebook",
      "campanha facebook",
      "para que serve facebook",
      "finalidade facebook",
      "como funciona facebook",
      "o que o facebook faz",
      "facebook dentro do iattom",
      "conectar facebook",
    ],
    status: "active",
    content: `O Facebook dentro do IAttom existe para acelerar a criação de campanhas, anúncios e conteúdos voltados para atrair compradores.

Com o contexto da sua campanha ou produto — público-alvo, objetivo, plataforma — o IAttom ajuda você a preparar o texto do anúncio, o criativo e a estrutura da campanha com mais velocidade e menos retrabalho.

Onde se encaixa no seu processo:
Definir produto e público → preparar anúncio e campanha → divulgar no Facebook para atrair compradores.

O IAttom atua na etapa de preparação: copy de anúncio, estrutura de campanha, texto de oferta e materiais de apoio para Facebook e Facebook Ads.`,
    relatedTopics: ["create-campaign"],
  },
  {
    id: "integration-instagram",
    category: "integrations",
    topic: "Instagram",
    keywords: [
      "instagram",
      "insta",
      "ig",
      "integração instagram",
      "reels",
      "stories",
      "feed instagram",
      "anúncio instagram",
      "campanha instagram",
      "para que serve instagram",
      "finalidade instagram",
      "como funciona instagram",
      "o que o instagram faz",
      "instagram dentro do iattom",
      "conectar instagram",
    ],
    status: "active",
    content: `O Instagram dentro do IAttom existe para acelerar a criação de conteúdos e anúncios voltados para engajamento e atração de compradores.

Com o contexto do seu perfil e produto — nicho, público, objetivo — o IAttom ajuda você a preparar legendas, textos de stories, roteiros de reels e materiais criativos com mais velocidade.

Onde se encaixa no seu processo:
Definir produto e conteúdo → preparar materiais de divulgação → publicar no Instagram para atrair compradores.

O IAttom atua na etapa de preparação: legendas, textos de stories, roteiros de reels, copy de anúncio e conteúdo para atrair e converter compradores pelo Instagram.`,
    relatedTopics: ["create-campaign", "create-content"],
  },
];
