import type { KnowledgeEntry } from "./index.js";

/**
 * Platform knowledge entries — structured facts, not module listings.
 *
 * Format rule: fatos sobre o que o IAttom resolve, para quem, quando usar,
 * quando NÃO usar e qual o papel dos módulos dentro da estratégia do usuário.
 * O LLM não deve copiar uma lista de módulos — deve raciocinar sobre a estratégia.
 */

export const platform: KnowledgeEntry[] = [
  {
    id: "platform-overview",
    category: "platform",
    topic: "O que é o IAttom Assist",
    keywords: [
      "iattom",
      "iattom assist",
      "o que é",
      "para que serve",
      "o que consigo fazer",
      "como essa plataforma",
      "o que a plataforma",
      "para que é",
      "o que vocês fazem",
      "o que fazem",
      "esse sistema",
      "essa ferramenta",
      "overview",
      "visão geral",
    ],
    status: "active",
    content: `O QUE É O IATTOM ASSIST

O que o IAttom resolve: o gap entre ter uma ideia ou produto e ter material pronto para vender, anunciar ou publicar — copy, campanha, conteúdo, scripts e criativos gerados com contexto de negócio real
Para quem serve: empreendedores, revendedores, criadores de conteúdo, infoprodutores, afiliados — qualquer pessoa que precisa acelerar a execução de marketing e vendas

Quando usar:
— quando o usuário já sabe (ou está próximo de saber) o que vender
— quando a execução é o gargalo, não a falta de produto ou estratégia
— quando o usuário precisa criar material de venda com mais velocidade e consistência

Quando NÃO usar:
— quando o usuário ainda não sabe o que vender — o IAttom acelera execução, não define produto ou estratégia de negócio
— quando o objetivo é hospedar ou publicar o produto diretamente — o IAttom prepara material, não publica
— quando o objetivo é automação de processos repetitivos — o IAttom gera, não automatiza
— quando o usuário precisa de consultoria de negócio para definir modelo de receita, precificação ou posicionamento — o IAttom executa, não define modelo de negócio

Diferença central entre ferramenta e estratégia:
O IAttom é ferramenta de execução — acelera o que o usuário já decidiu fazer, não decide o que o usuário deveria fazer
A estratégia é do usuário: o que vender, para quem, por qual canal, com qual oferta
O IAttom executa essa estratégia mais rápido: gera o copy, o script, o conteúdo, a campanha

Papel dos módulos dentro do objetivo do usuário:
Os módulos existem para executar etapas da estratégia do usuário — não para definir a estratégia
O módulo certo depende do objetivo e do estágio, não da ordem em que aparecem no menu
Usar módulos sem produto e objetivo definidos produz outputs genéricos que não convertem

Fluxo principal: descobrir oportunidade → validar viabilidade → preparar oferta → criar campanha/conteúdo/criativo → organizar e iterar

Limitações que importa saber:
— não publica diretamente em plataformas externas (Hotmart, Shopee, Mercado Livre, etc.)
— não hospeda produtos digitais
— não automatiza processos de venda
— não substitui decisão estratégica de negócio
— não define automaticamente o que o usuário deveria vender

Módulos disponíveis: Buscar Produtos, Validar Produto, Criar Campanha, Criar Conteúdo, Gerador Criativo, Scripts de Vídeo
Integrações de contexto: Mercado Livre, Shopee, TikTok, Hotmart, Kiwify, Facebook, Instagram
Workspace: Projetos Salvos, Histórico de Atividades, Prompts Salvos`,
    relatedTopics: ["platform-onboarding", "find-products", "create-campaign"],
  },
  {
    id: "platform-onboarding",
    category: "platform",
    topic: "Como começar a usar o IAttom Assist",
    keywords: [
      "como começo",
      "por onde começo",
      "o que faço primeiro",
      "sou iniciante",
      "primeiro passo",
      "começar",
      "iniciar",
      "quero começar",
      "como usar",
      "não sei por onde começar",
      "orientação",
      "guia",
      "ajuda para começar",
      "primeiros passos",
      "conectar tudo",
      "devo conectar",
      "conectar plataformas",
      "caminho mais simples",
      "caminho",
      "por onde ir",
      "me leva",
      "o que não fazer",
      "não deveria fazer",
      "começando pelo lugar",
      "sócio",
      "faria primeiro",
      "lugar errado",
    ],
    status: "active",
    content: `COMO COMEÇAR A USAR O IATTOM ASSIST

Pergunta que define o caminho inteiro: você já sabe o que quer vender?
Essa resposta determina qual módulo faz sentido, qual integração conectar e onde gastar os primeiros créditos.

SE NÃO TEM PRODUTO DEFINIDO:
— antes de qualquer módulo: definir tipo de produto (físico ou digital) e nicho
— produto físico → Buscar Produtos → Validar Produto → depois Criar Campanha
— produto digital → definir tema e validar demanda → depois Criar Conteúdo e Criar Campanha
— não usar Criar Campanha antes de ter produto validado — o output será genérico e não vai converter
— não conectar plataformas antes de saber o que vender — a integração adiciona contexto, não substitui o produto

SE TEM PRODUTO, QUER LANÇAR:
— Validar Produto (confirmar potencial) → Criar Campanha → Criar Conteúdo → Gerador Criativo → salvar em Projetos

SE QUER VENDER EM MARKETPLACE:
— integração Mercado Livre ou Shopee → Criar Campanha com contexto da plataforma pré-carregado
— só faz sentido depois que o produto está definido e a margem calculada

SE QUER VENDER PRODUTO DIGITAL:
— integração Hotmart ou Kiwify → Criar Campanha → Scripts de Vídeo → Criar Conteúdo
— só faz sentido depois que o produto e a oferta estão definidos

SE QUER CRIAR CONTEÚDO PARA REDES SOCIAIS:
— Criar Conteúdo → Scripts de Vídeo → Gerador Criativo (sem precisar conectar integração)

SOBRE CONECTAR PLATAFORMAS:
Conectar Hotmart, Shopee, TikTok etc. adiciona contexto de plataforma ao gerar campanhas e conteúdo
Mas conectar sem produto definido não acelera nada — a integração serve a um produto, não substitui a falta de produto
Ordem correta: definir produto → validar → criar campanha → conectar a plataforma onde vai publicar

O QUE NÃO FAZER AO COMEÇAR:
— não conectar todas as plataformas antes de saber o que vender
— não criar campanha com produto ainda não validado — o output será genérico
— não gastar créditos em múltiplos módulos sem objetivo claro
— não pular validação de produto achando que campanha vai compensar — campanha boa com produto ruim não vende
— não escolher plataforma de venda antes de definir o produto — a plataforma é consequência do produto

CAMINHO MAIS SIMPLES PARA COMEÇAR DO ZERO:
1. Definir: produto físico ou digital? Qual nicho?
2. Descobrir: Buscar Produtos (encontrar oportunidade) ou Validar Produto (confirmar o que já tem)
3. Confirmar: Validar Produto antes de qualquer investimento
4. Executar: Criar Campanha com produto e público definidos
5. Salvar: Projetos Salvos para manter o histórico e reutilizar`,
    relatedTopics: ["platform-overview", "find-products", "create-campaign"],
  },
];
