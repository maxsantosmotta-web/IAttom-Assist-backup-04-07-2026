import type { KnowledgeEntry } from "./index.js";

export const roadmap: KnowledgeEntry[] = [
  {
    id: "roadmap-oauth",
    category: "roadmap",
    topic: "OAuth real para integrações",
    keywords: [
      "oauth",
      "login com conta",
      "login com minha conta",
      "conta própria",
      "conectar minha conta",
      "conectar conta",
      "autenticar",
      "login integração",
      "autenticação real",
      "quando vai ter login",
      "integração real",
      "conta do shopee",
      "conta do mercado livre",
      "conta do tiktok",
      "conta do hotmart",
      "conta do kiwify",
      "conta do facebook",
      "conta do instagram",
    ],
    status: "future",
    content: `O login com conta real (OAuth) para todas as plataformas integradas está no roadmap aprovado e será disponibilizado em versão futura.

Plataformas previstas: Mercado Livre, Shopee, TikTok, Hotmart, Kiwify, Facebook, Instagram, WhatsApp.

Atualmente as integrações funcionam via webhook e configuração manual — o OAuth direto ainda não está disponível.`,
    relatedTopics: ["integration-mercado-livre", "integration-shopee", "integration-tiktok"],
  },
  {
    id: "roadmap-approved-features",
    category: "roadmap",
    topic: "Funcionalidades aprovadas e em desenvolvimento",
    keywords: [
      "roadmap",
      "futuro",
      "próxima versão",
      "em breve",
      "vai ter",
      "quando vai ter",
      "o que vai ter",
      "próximas funcionalidades",
      "funcionalidades futuras",
      "publicação",
      "publicação assistida",
      "publicação automática",
      "criar anúncio",
      "anúncio",
      "biblioteca",
      "biblioteca de conteúdo",
      "salvar campanha",
      "salvar imagem",
    ],
    status: "future",
    content: `As seguintes funcionalidades estão oficialmente no roadmap aprovado e serão disponibilizadas em versões futuras:

- OAuth real para todas as integrações (Mercado Livre, Shopee, TikTok, Hotmart, Kiwify, Facebook, Instagram, WhatsApp).
- Criar Anúncio: módulo dedicado para criação de anúncios (diferente do Criar Campanha).
- Publicação Assistida: publicação guiada de conteúdo nas plataformas.
- Publicação Automática: publicação programada sem intervenção manual.
- Biblioteca de conteúdo: pasta para salvar e organizar campanhas, imagens, scripts e conteúdos gerados.
- Renomeação de "Gerador Criativo" para "Criar Imagem" na interface.
- Melhoria no fluxo de verificação de login.
- Isolamento completo de dados por usuário no módulo Mercado Livre.`,
  },
  {
    id: "roadmap-unavailable",
    category: "roadmap",
    topic: "Funcionalidades não disponíveis e sem previsão",
    keywords: [
      "não existe",
      "não tem",
      "não disponível",
      "edição de vídeo",
      "cortar vídeo",
      "timeline de vídeo",
      "canva",
      "adobe",
      "crm",
      "chatbot",
      "importar contatos",
      "base de contatos",
      "ferramenta externa",
    ],
    status: "unavailable",
    content: `As seguintes funcionalidades não existem no IAttom Assist e não possuem previsão de lançamento:

- Edição de vídeo (corte, splice, timeline de vídeo).
- Integração com ferramentas externas como Canva, Adobe ou similares.
- Importação de base de contatos.
- CRM nativo.
- Chatbot para clientes finais dos usuários.`,
  },
  {
    id: "roadmap-admin-panel",
    category: "roadmap",
    topic: "Painel administrativo",
    keywords: [
      "admin",
      "painel admin",
      "administrador",
      "painel administrativo",
      "acesso admin",
      "área administrativa",
    ],
    status: "active",
    content: `O IAttom Assist possui um painel administrativo exclusivo para a equipe interna da plataforma.
Usuários comuns não têm acesso ao painel admin.
O painel admin é somente leitura: monitora contas, KPIs, atividade, integrações e logs.
Nenhuma operação manual é executada na conta do usuário a partir do painel admin.`,
  },
  {
    id: "roadmap-iattom-help",
    category: "roadmap",
    topic: "Evolução do IAttom Help",
    keywords: [
      "iattom help",
      "assistente",
      "chat suporte",
      "base de conhecimento",
      "diagnóstico",
      "análise de print",
      "diagnóstico visual",
      "evolução do assistente",
    ],
    status: "future",
    content: `O IAttom Help está em evolução contínua. Capacidades futuras registradas no roadmap:

- Base oficial de conhecimento em expansão contínua.
- Suporte por análise de prints e imagens (diagnóstico visual de erros).
- Diagnóstico visual de configurações e resultados.
- Evolução do contexto conversacional para sessões mais longas.

Atualmente disponível: chat em linguagem natural com base de conhecimento oficial do IAttom Assist.`,
  },
  {
    id: "roadmap-video-evolution",
    category: "roadmap",
    topic: "Evolução de vídeo",
    keywords: [
      "vídeo avançado",
      "campanha com vídeo",
      "geração de vídeo",
      "roteiro avançado",
      "cena",
      "legenda vídeo",
      "vídeo por plataforma",
      "vídeo para tiktok",
      "vídeo para reels",
    ],
    status: "future",
    content: `A evolução de geração de vídeo está no roadmap aprovado com as seguintes capacidades futuras:

- Campanha com vídeo dentro do módulo Criar Campanha.
- Evolução do Gerador Criativo com suporte a vídeo.
- Estrutura futura: roteiro completo com cenas, fala, legenda e CTA específico por plataforma.

Atualmente disponível: Scripts de Vídeo (roteiros em texto) e Gerador Criativo (ideias criativas visuais).`,
    relatedTopics: ["video-scripts", "creative-generator"],
  },
  {
    id: "roadmap-platform-intelligence",
    category: "roadmap",
    topic: "Inteligência por plataforma",
    keywords: [
      "inteligência por plataforma",
      "prompts específicos",
      "estratégia por plataforma",
      "especialização",
      "menos genérico",
      "específico para shopee",
      "específico para tiktok",
      "específico para mercado livre",
    ],
    status: "future",
    content: `A especialização da IA por plataforma está no roadmap aprovado:

- Prompts especializados e estruturas de conteúdo menos genéricas para cada plataforma.
- Estratégias específicas para: Mercado Livre, Shopee, Hotmart, Kiwify, TikTok, Facebook e Instagram.

Atualmente, os módulos centrais já aceitam contexto de plataforma via prefill. A especialização profunda por canal chegará em versão futura.`,
    relatedTopics: ["create-campaign", "create-content"],
  },
  {
    id: "roadmap-strategic-intelligence",
    category: "roadmap",
    topic: "Evolução estratégica do IAttom",
    keywords: [
      "análise de negócio",
      "diagnóstico de negócio",
      "funil",
      "funil de vendas",
      "afiliados",
      "ebook",
      "criar ebook",
      "curso",
      "criar curso",
      "renda extra",
      "oportunidade",
      "análise de instagram",
      "analisar instagram",
      "estratégia avançada",
    ],
    status: "future",
    content: `A evolução estratégica do IAttom está no roadmap aprovado com as seguintes capacidades futuras:

- Análise de negócio e diagnóstico estratégico.
- Análise de perfis do Instagram.
- Ideias de renda extra personalizadas.
- Criação de funis de vendas.
- Operação de afiliados.
- Criação de eBooks.
- Criação de cursos.
- Recomendações de oportunidades comerciais.

Estas capacidades não estão disponíveis na versão atual da plataforma.`,
  },
];
