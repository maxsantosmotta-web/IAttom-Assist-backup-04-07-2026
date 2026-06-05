import type { KnowledgeEntry } from "./index.js";

export const integrations: KnowledgeEntry[] = [
  {
    id: "integration-mercado-livre",
    category: "integrations",
    topic: "Mercado Livre",
    keywords: [
      "mercado livre",
      "mercado livre integração",
      "meli",
      "ml integração",
      "vender no mercado livre",
      "integração mercado livre",
      "plataforma mercado livre",
      "marketplace mercado livre",
    ],
    status: "active",
    content: `O Mercado Livre dentro do IAttom permite acompanhar métricas, visualizar o status da integração e criar campanhas utilizando o contexto da plataforma — sem precisar sair da ferramenta.
Botão "Criar Campanha" disponível com dados da plataforma pré-preenchidos.
Webhook disponível para configuração e cópia.
Limitação atual: isolamento completo de dados por usuário está registrado como pendência no roadmap.
OAuth real (login com sua conta Mercado Livre) está no roadmap e ainda não está disponível.
Rota: /dashboard/mercado-livre`,
    relatedTopics: ["create-campaign", "roadmap-oauth"],
  },
  {
    id: "integration-shopee",
    category: "integrations",
    topic: "Shopee",
    keywords: [
      "shopee",
      "integração shopee",
      "plataforma shopee",
      "loja shopee",
      "vender na shopee",
      "shopee integração",
      "shopee loja",
    ],
    status: "active",
    content: `O Shopee dentro do IAttom permite acompanhar métricas, visualizar o status da integração e criar campanhas com o contexto da plataforma pré-preenchido.
Botão "Criar Campanha" disponível com dados da Shopee já carregados.
Webhook disponível para configuração e cópia.
OAuth real (login com sua conta Shopee) está no roadmap e ainda não está disponível.
Rota: /dashboard/shopee`,
    relatedTopics: ["create-campaign", "roadmap-oauth"],
  },
  {
    id: "integration-tiktok",
    category: "integrations",
    topic: "TikTok",
    keywords: [
      "tiktok",
      "tik tok",
      "integração tiktok",
      "plataforma tiktok",
      "tiktok shop",
      "vídeo tiktok",
      "vender no tiktok",
      "tiktok integração",
    ],
    status: "active",
    content: `O TikTok dentro do IAttom permite acompanhar KPIs, visualizar posts e eventos da integração.
Botão "Criar Campanha" disponível com contexto TikTok pré-preenchido.
Webhook disponível.
OAuth real está no roadmap e ainda não está disponível.
Rota: /dashboard/tiktok`,
    relatedTopics: ["create-campaign", "video-scripts", "roadmap-oauth"],
  },
  {
    id: "integration-hotmart",
    category: "integrations",
    topic: "Hotmart",
    keywords: [
      "hotmart",
      "integração hotmart",
      "plataforma hotmart",
      "produto digital hotmart",
      "curso hotmart",
      "infoproduto hotmart",
      "vender no hotmart",
      "hotmart integração",
    ],
    status: "active",
    content: `O Hotmart dentro do IAttom permite acompanhar produtos digitais, métricas de vendas e status da integração.
Botão "Criar Campanha" disponível com contexto Hotmart pré-preenchido.
Webhook disponível.
OAuth real está no roadmap e ainda não está disponível.
Rota: /dashboard/hotmart`,
    relatedTopics: ["create-campaign", "roadmap-oauth"],
  },
  {
    id: "integration-kiwify",
    category: "integrations",
    topic: "Kiwify",
    keywords: [
      "kiwify",
      "integração kiwify",
      "plataforma kiwify",
      "produto digital kiwify",
      "vender no kiwify",
      "kiwify integração",
      "kiwify loja",
    ],
    status: "active",
    content: `O Kiwify dentro do IAttom permite acompanhar produtos, métricas e status da integração.
Botão "Criar Campanha" disponível com contexto Kiwify pré-preenchido.
Webhook disponível.
OAuth real está no roadmap e ainda não está disponível.
Rota: /dashboard/kiwify`,
    relatedTopics: ["create-campaign", "roadmap-oauth"],
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
      "plataforma facebook",
      "facebook ads",
      "facebook business",
      "anúncio facebook",
      "campanha facebook",
    ],
    status: "active",
    content: `O Facebook dentro do IAttom permite acompanhar métricas de campanha e status da integração.
Botão "Criar Campanha" disponível com contexto Facebook pré-preenchido.
OAuth real (login com conta Facebook Business) está no roadmap e ainda não está disponível.
Rota: /dashboard/facebook`,
    relatedTopics: ["create-campaign", "roadmap-oauth"],
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
      "plataforma instagram",
      "reels",
      "stories",
      "feed instagram",
      "anúncio instagram",
      "campanha instagram",
    ],
    status: "active",
    content: `O Instagram dentro do IAttom permite acompanhar posts, métricas de engajamento e status da integração.
Botão "Criar Campanha" disponível com contexto Instagram pré-preenchido.
OAuth real está no roadmap e ainda não está disponível.
Rota: /dashboard/instagram`,
    relatedTopics: ["create-campaign", "create-content", "roadmap-oauth"],
  },
];
