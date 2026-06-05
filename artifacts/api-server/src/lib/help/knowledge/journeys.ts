import type { KnowledgeEntry } from "./index.js";

/**
 * Journey knowledge entries — structured facts, not step-by-step scripts.
 *
 * Format rule: cada entry é um conjunto de fatos que o LLM usa para raciocinar
 * a partir do estágio e objetivo real do usuário. Não são roteiros prontos.
 * O LLM lê os fatos e monta a resposta adequada — estratégia primeiro, módulos depois.
 */

export const journeys: KnowledgeEntry[] = [
  {
    id: "journey-earn-money",
    category: "journeys",
    topic: "Jornada: Ganhar dinheiro online",
    keywords: [
      "ganhar dinheiro",
      "renda extra",
      "renda online",
      "monetizar",
      "monetização",
      "como ganhar",
      "o que vender",
      "começar a vender",
      "vender online",
      "quero vender",
      "faturar",
      "lucrar",
      "gerar renda",
      "gerar lucro",
      "trabalhar online",
      "empreender",
      "afiliado",
      "afiliados",
      "não sei o que vender",
      "não quero aparecer",
      "sem aparecer",
    ],
    status: "active",
    content: `GANHAR DINHEIRO ONLINE

Objetivo do usuário: gerar renda usando a internet, sem ter ainda um produto ou modelo de negócio definido
Estágio inicial típico: zero — sem produto definido, sem audiência consolidada, sem canal de venda ativo
Quando esta jornada se aplica: o usuário sabe que quer ganhar dinheiro online mas ainda não sabe o que vender, qual caminho seguir ou por onde começar
Quando NÃO se aplica: quando o usuário já tem produto definido — usar a jornada específica do tipo de produto

Risco mais comum: começar por conteúdo, campanha ou escolha de plataforma antes de definir e validar o produto — resultado: energia e créditos gastos sem produto para vender
Segundo risco: escolher a plataforma antes de escolher o produto — a plataforma é consequência do produto, não o ponto de partida

Decisão que define o caminho inteiro: produto físico ou produto digital?
Produto físico: para quem quer revender sem aparecer, tem acesso a fornecedores ou prefere marketplace; não exige produção de conteúdo; plataformas: Mercado Livre, Shopee
Produto digital: para quem tem conhecimento, habilidade ou audiência; escalável sem estoque; geralmente exige aparecer; plataformas: Hotmart, Kiwify
Se não quer aparecer de forma alguma: produto físico em marketplace é o caminho mais simples — não exige presença pública
Se tem conhecimento mas não quer aparecer: produtos digitais como templates, planilhas e checklists são possíveis sem aparecer; cursos e mentorias geralmente exigem presença

Ordem estratégica:
1. Definir tipo de produto (físico ou digital) e nicho com demanda real
2. Encontrar uma oportunidade específica dentro do nicho
3. Validar que existe demanda antes de criar qualquer material
4. Preparar oferta, anúncio e materiais de venda
5. Escolher canal e escalar

Módulos como ferramentas de execução (não o ponto de partida):
Buscar Produtos — etapa 2: encontrar oportunidades com demanda no nicho escolhido
Validar Produto — etapa 3: confirmar viabilidade antes de investir tempo e dinheiro
Criar Campanha — etapa 4: quando produto e oferta estiverem definidos e validados

Resultado esperado: clareza sobre o que vender e um caminho definido antes de gastar recursos em campanha, conteúdo ou integração com plataformas`,
    relatedTopics: [
      "find-products",
      "validate-products",
      "journey-physical-product",
      "journey-digital-product",
    ],
  },
  {
    id: "journey-physical-product",
    category: "journeys",
    topic: "Jornada: Vender produto físico em marketplace",
    keywords: [
      "produto físico",
      "vender produto físico",
      "marketplace",
      "vender em marketplace",
      "shopee produto físico",
      "mercado livre produto",
      "produto para revender",
      "revenda",
      "estoque",
      "vender na shopee",
      "vender no mercado livre",
      "loja online",
      "sem aparecer",
      "não quero aparecer",
    ],
    status: "active",
    content: `VENDER PRODUTO FÍSICO EM MARKETPLACE

Objetivo do usuário: vender produtos físicos via Mercado Livre ou Shopee
Estágio inicial típico: tem interesse em produto físico — pode ou não ter o produto já definido
Quando esta jornada se aplica: produto físico está escolhido ou há nicho claro de interesse
Quando NÃO se aplica: quando o produto ainda não está definido — escolher plataforma antes do produto é inverter a ordem; quando não há capital mínimo para estoque ou logística

Risco mais comum: criar anúncio e campanha antes de validar se o produto tem demanda real e margem suficiente — resultado: anúncio pronto, produto sem comprador
Segundo risco: entrar em nicho saturado sem diferencial claro; muita concorrência não é problema se o anúncio tem diferencial — mas sem diferencial não há resultado

Decisão sobre qual marketplace:
Mercado Livre: ticket médio mais alto, comprador menos sensível a preço, valoriza confiança e qualidade do anúncio
Shopee: ticket baixo, comprador sensível a preço e promoção, maior volume mas margem menor
Regra: o produto e a margem definem o marketplace, não a preferência pessoal

O que deve estar resolvido antes de criar anúncio ou campanha:
— produto definido com fornecedor real e custo calculado
— margem calculada: preço de venda - custo - taxas da plataforma = lucro real
— diferencial identificado: por que o comprador escolheria este anúncio?

Casos negativos — não avançar para campanha se:
— produto não tem demanda validada (não há busca ou venda de concorrentes no marketplace)
— margem é negativa ou menor que 20% após taxas
— não há fornecedor garantido ou logística mínima definida

Ordem estratégica:
1. Definir produto e nicho com demanda real
2. Validar demanda e calcular margem antes de qualquer investimento
3. Garantir fornecedor e estoque mínimo
4. Criar anúncio estruturado com diferencial claro
5. Criar materiais de campanha e divulgação

Módulos como ferramentas de execução:
Buscar Produtos — etapa 1: descoberta de produtos com demanda no marketplace
Validar Produto — etapa 2: análise de viabilidade antes de investir em estoque
Criar Campanha — etapa 4: copy e estrutura do anúncio adaptado ao marketplace
Gerador Criativo — etapa 4: materiais visuais para o anúncio

Resultado esperado: entrar no marketplace com produto validado, margem calculada e anúncio diferenciado`,
    relatedTopics: [
      "find-products",
      "validate-products",
      "integration-mercado-livre",
      "integration-shopee",
      "create-campaign",
    ],
  },
  {
    id: "journey-digital-product",
    category: "journeys",
    topic: "Jornada: Vender produto digital",
    keywords: [
      "produto digital",
      "vender produto digital",
      "infoproduto",
      "vender infoproduto",
      "produto online",
      "venda digital",
      "hotmart",
      "kiwify",
      "lançamento digital",
      "lançamento",
      "perpétuo",
      "transformar conhecimento",
      "vender conhecimento",
      "monetizar conhecimento",
      "conhecimento em produto",
      "transformar experiência em produto",
      "vender minha experiência",
      "tenho conhecimento",
      "expertise",
      "criar produto digital",
      "produto de conhecimento",
    ],
    status: "active",
    content: `VENDER PRODUTO DIGITAL

Objetivo do usuário: transformar conhecimento, habilidade ou conteúdo em produto digital vendável — curso, ebook, mentoria, assinatura
Estágio inicial típico: tem expertise ou conhecimento mas ainda não estruturou como produto; ou já tem produto e quer lançar
Quando esta jornada se aplica: usuário tem algo a ensinar, compartilhar ou distribuir no formato digital
Quando NÃO se aplica: quando o produto digital ainda não está definido e o usuário está apenas explorando — definir formato e nicho antes de pensar em lançamento

Risco mais comum: criar toda a estrutura do produto (módulos, aulas, materiais) antes de validar se existe demanda e disposição a pagar — resultado: produto pronto que não vende
Segundo risco: escolher plataforma (Hotmart ou Kiwify) antes de definir o produto e o público — a plataforma é secundária; o produto é a decisão central

Sobre a escolha de plataforma:
Hotmart: mais consolidada, maior base de afiliados, taxas um pouco maiores, mais usada para cursos e mentorias estabelecidos com volume
Kiwify: interface mais simples, taxas menores, crescente, boa para produtos menores e creators que estão começando
Regra: plataforma é detalhe operacional — não é onde a jornada começa

O que deve estar resolvido antes de criar materiais de lançamento:
— nicho e tema definidos e pesquisados
— formato escolhido: curso, ebook, mentoria, assinatura
— demanda validada: pessoas já pagam por isso de outra forma?
— proposta de valor clara: o comprador consegue exatamente o quê após o produto?

Casos negativos — não avançar para lançamento se:
— tema escolhido por paixão sem confirmar se há comprador disposto a pagar
— proposta genérica ("aprenda marketing") sem recorte específico de público e resultado
— nenhum pré-aquecimento de audiência (para lançamento) ou tráfego mínimo definido (para perpétuo)

Ordem estratégica:
1. Definir nicho, tema específico e formato do produto
2. Validar demanda antes de criar qualquer material
3. Estruturar a oferta e a proposta de valor
4. Criar materiais de lançamento: copy, campanha, conteúdo de aquecimento, scripts
5. Escolher plataforma e publicar

Módulos como ferramentas de execução:
Criar Conteúdo — etapas 3 e 4: estrutura do produto, textos de descrição, materiais de aquecimento
Scripts de Vídeo — etapa 4: roteiro de apresentação, aulas demonstrativas, vídeos de divulgação
Criar Campanha — etapa 4: copy de venda, headline, oferta, argumentos de conversão
Gerador Criativo — etapa 4: banner, capa, materiais de divulgação

Resultado esperado: produto lançado com demanda validada, oferta estruturada e materiais de venda prontos`,
    relatedTopics: [
      "integration-hotmart",
      "integration-kiwify",
      "create-campaign",
      "create-content",
      "video-scripts",
    ],
  },
  {
    id: "journey-ebook",
    category: "journeys",
    topic: "Jornada: Criar e vender um eBook",
    keywords: [
      "ebook",
      "e-book",
      "livro digital",
      "criar ebook",
      "criar e-book",
      "escrever ebook",
      "escrever livro",
      "vender ebook",
      "publicar ebook",
      "livro online",
    ],
    status: "active",
    content: `CRIAR E VENDER UM EBOOK

Objetivo do usuário: criar e vender um livro digital sobre tema de expertise ou interesse
Estágio inicial típico: tem ideia do tema mas ainda não escreveu ou estruturou o eBook
Quando esta jornada se aplica: tema está definido e há conhecimento ou pesquisa suficiente para criar o conteúdo
Quando NÃO se aplica: quando o tema ainda não foi validado — escrever o eBook antes de confirmar que alguém vai comprá-lo é o erro mais comum desta jornada

Risco mais comum: escrever o eBook completo antes de validar se existe disposição a pagar pelo tema — horas de trabalho num produto que não vende
Segundo risco: proposta genérica demais ("eBook sobre marketing digital") — eBooks que vendem têm recorte específico de público e resultado prometido

Decisão principal: o tema tem demanda? Existe algo similar sendo vendido? O público compraria isso?
Indicador positivo: outros autores vendem sobre o tema + existe busca ativa + o usuário tem perspectiva única ou mais simples que a concorrência

O que deve estar resolvido antes de escrever:
— tema e público-alvo definidos com especificidade ("guia de X para Y que tem Z dificuldade")
— demanda básica validada
— proposta específica: o que o leitor consegue ao terminar de ler?

Casos negativos:
— não criar eBook antes de validar se alguém pagaria pelo tema
— não usar conteúdo genérico sem perspectiva diferenciada
— não escolher plataforma de distribuição antes de ter o conteúdo estruturado

Ordem estratégica:
1. Validar tema e demanda
2. Definir proposta e público específico
3. Estruturar o eBook (capítulos, fluxo, resultado prometido)
4. Criar o conteúdo textual
5. Criar materiais de venda: copy, página de vendas, divulgação
6. Publicar via Hotmart ou Kiwify

Módulos como ferramentas de execução:
Criar Conteúdo — etapas 3 e 4: estrutura dos capítulos, textos das seções, introdução e conclusão
Criar Campanha — etapa 5: copy de venda, headline, argumentos de conversão
Scripts de Vídeo — etapa 5: roteiro de vídeo de apresentação do eBook
Gerador Criativo — etapa 5: capa, banner e materiais de divulgação

Limitação: o IAttom gera o conteúdo textual — a formatação final do arquivo (.pdf) é feita externamente pelo usuário`,
    relatedTopics: [
      "create-content",
      "create-campaign",
      "integration-hotmart",
      "integration-kiwify",
    ],
  },
  {
    id: "journey-course",
    category: "journeys",
    topic: "Jornada: Criar e vender um curso online",
    keywords: [
      "curso",
      "curso online",
      "criar curso",
      "vender curso",
      "fazer curso",
      "aula",
      "aulas",
      "treinamento",
      "mentoria",
      "lançar curso",
      "plataforma de curso",
      "tenho experiência",
      "minha habilidade",
      "transformar habilidade",
      "produto educacional",
      "ensinar online",
    ],
    status: "active",
    content: `CRIAR E VENDER UM CURSO ONLINE

Objetivo do usuário: transformar conhecimento ou habilidade em curso online vendável
Estágio inicial típico: tem expertise numa área e quer monetizá-la; ou já tem audiência e quer criar produto pago
Quando esta jornada se aplica: há expertise definida, público minimamente identificado e disposição para aparecer (gravar ou ensinar ao vivo)
Quando NÃO se aplica: quando o tema ainda não foi validado com potencial compradores; quando não há disposição para aparecer em vídeo ou ao vivo — nesse caso, ebook ou templates podem ser alternativa

Risco mais comum: criar o curso completo (gravar todas as aulas, montar plataforma) antes de ter um único comprador — produto finalizado sem demanda confirmada
Segundo risco: criar curso sobre tema que o usuário domina mas o mercado não demanda na forma que ele quer ensinar — validar antes é essencial

Decisão sobre formato:
Lançamento: período de aquecimento de audiência + janela de vendas; resultados maiores num período curto; exige audiência prévia ou tráfego pago
Perpétuo: vende continuamente; precisa de tráfego constante; funciona melhor para quem já tem audiência ou canal de tráfego definido
Mentoria em grupo: menor produção de material; resultado mais rápido para testar; ideal para validação antes de gravar o curso completo

O que deve estar resolvido antes de gravar ou criar material do curso:
— tema, nível e público específico definidos (não "todo mundo que quer aprender X")
— demanda validada — idealmente com pré-venda, lista de espera ou pesquisa direta
— proposta de valor clara: o aluno consegue exatamente o quê ao finalizar o curso?
— formato escolhido: gravado, ao vivo, mentoria

Casos negativos:
— não gravar o curso completo antes de validar demanda — grave uma aula de demonstração, venda, depois grave o restante
— não lançar para audiência zero sem tráfego pago mínimo definido
— não escolher Hotmart ou Kiwify antes de ter o produto estruturado — plataforma é detalhe operacional

Ordem estratégica:
1. Validar tema e demanda com público real
2. Definir formato, módulos e promessa do curso
3. Criar materiais de lançamento ou página de vendas
4. Criar conteúdo de aquecimento (antes de vender)
5. Vender e depois finalizar a produção das aulas

Módulos como ferramentas de execução:
Criar Conteúdo — etapas 2 e 4: estrutura de módulos, roteiros de aulas, conteúdo de aquecimento
Scripts de Vídeo — etapas 2, 3 e 5: roteiros de aulas, vídeo de apresentação, aulas demonstrativas
Criar Campanha — etapa 3: copy de lançamento, página de vendas, anúncios
Gerador Criativo — etapa 3: banner, capa, criativos de anúncio

Resultado esperado: curso lançado com demanda validada antes da produção completa`,
    relatedTopics: [
      "video-scripts",
      "create-content",
      "create-campaign",
      "integration-hotmart",
      "integration-kiwify",
    ],
  },
  {
    id: "journey-full-campaign",
    category: "journeys",
    topic: "Jornada: Criar uma campanha completa",
    keywords: [
      "campanha completa",
      "criar campanha completa",
      "campanha do zero",
      "estratégia completa",
      "campanha de marketing",
      "lançamento",
      "funil",
      "funil de vendas",
      "campanha de anúncio",
      "anúncios",
      "estrutura de campanha",
      "montar campanha",
    ],
    status: "active",
    content: `CRIAR UMA CAMPANHA COMPLETA

Objetivo do usuário: criar campanha de marketing completa para um produto com oferta e público definidos
Estágio inicial típico: tem produto definido (ou próximo disso) e quer criar a estrutura de divulgação
Quando esta jornada se aplica: produto, público-alvo e plataforma de destino já estão definidos ou próximos de definição
Quando NÃO se aplica: quando o produto ainda não foi validado — campanha sem produto validado é desperdício de créditos e mídia; quando a oferta (proposta de valor, preço, diferencial) ainda não está clara

Risco mais comum: criar campanha com produto genérico ou oferta fraca — o problema nesse caso não é a campanha, é a oferta; boa campanha com oferta ruim não vende
Segundo risco: criar campanha para todos os canais ao mesmo tempo antes de testar em um — resultado: muito material, nenhum aprendizado claro

Decisão sobre canal:
Facebook/Instagram Ads: bom para produto visual com público definido; copy explicativa; alcance preciso por segmentação
TikTok: bom para produto com público jovem; formato de vídeo; alcance orgânico alto para contas novas
Mercado Livre/Shopee: bom para produto físico; foco em título, descrição e diferencial de preço/qualidade
Regra: um canal de teste primeiro, escalar depois — não todos ao mesmo tempo

O que deve estar resolvido antes de criar a campanha:
— produto definido e com viabilidade confirmada
— público-alvo específico: quem é, qual dor tem, por que compraria agora
— oferta clara: o que o comprador ganha, por quanto, por que é diferente
— canal de destino escolhido

Casos negativos:
— não criar campanha com produto ainda não validado
— não criar campanha para público genérico ("todo mundo")
— não gastar créditos em campanha antes de ter oferta clara — oferta fraca não melhora com mais volume

Ordem estratégica:
1. Confirmar produto, oferta e público
2. Escolher canal prioritário para teste
3. Criar copy e estrutura da campanha (headline, oferta, CTA)
4. Criar conteúdo de suporte (posts, stories, e-mails)
5. Criar criativos visuais e scripts de vídeo se necessário

Módulos como ferramentas de execução:
Criar Campanha — etapa 3: núcleo da campanha; headline, copy, estrutura de anúncio, CTA
Criar Conteúdo — etapa 4: posts, stories, e-mails, descrições de suporte
Gerador Criativo — etapa 5: conceitos de imagem, banner, criativo de anúncio
Scripts de Vídeo — etapa 5: roteiros para reels, TikToks, vídeos de vendas

Resultado esperado: campanha estruturada e pronta para publicar, com copy, visual e script alinhados ao canal — não apenas material gerado sem objetivo`,
    relatedTopics: [
      "create-campaign",
      "create-content",
      "creative-generator",
      "video-scripts",
    ],
  },
  {
    id: "journey-grow-business",
    category: "journeys",
    topic: "Jornada: Melhorar e crescer o negócio",
    keywords: [
      "melhorar negócio",
      "crescer negócio",
      "escalar",
      "vender mais",
      "crescimento",
      "melhorar resultados",
      "otimizar",
      "aumentar vendas",
      "mais clientes",
      "estratégia de crescimento",
      "negócio",
      "negócios",
      "empreendimento",
      "como melhorar",
    ],
    status: "active",
    content: `MELHORAR E CRESCER O NEGÓCIO

Objetivo do usuário: escalar ou melhorar um negócio que já existe — aumentar vendas, alcance, consistência ou faturamento
Estágio inicial típico: já vende algo, mas os resultados estão abaixo do esperado ou estagnados
Quando esta jornada se aplica: há negócio ativo com vendas (mesmo que pequenas) e o objetivo é crescer a partir do que já funciona
Quando NÃO se aplica: quando o negócio ainda não está validado — crescer algo que não vende não resolve o problema; o problema nesse caso está na oferta ou no produto, não na execução

Diagnóstico antes de qualquer ação — a ação correta depende do gargalo real:
Não vende o suficiente: o problema está na oferta (produto/preço/diferencial) ou na campanha (copy/criativo/canal)? São problemas diferentes com soluções diferentes
Vende mas pouco: gargalo de alcance (tráfego baixo), conversão (visita mas não compra) ou retenção (comprou uma vez, não voltou)?
Não aparece para o público certo: gargalo de segmentação ou de canal — o público pode estar em outro canal ainda não explorado
Vendas inconsistentes: falta de fluxo de conteúdo sistemático ou dependência de um único canal com variação de resultado

Risco mais comum: começar pela execução (mais conteúdo, mais campanhas) sem primeiro entender por que o que já existe não está funcionando — resultado: mais do mesmo problema com mais esforço
Segundo risco: escalar algo que não funciona achando que volume vai compensar a oferta fraca — volume amplifica o que já existe, não corrige

Casos negativos:
— não criar mais campanhas antes de saber o que está impedindo as atuais de converterem
— não diversificar canais antes de ter pelo menos um canal que funciona minimamente
— não criar mais conteúdo antes de entender se o conteúdo atual tem audiência mínima

Decisão principal: qual é o gargalo real?
Oferta fraca → ajustar produto, preço ou diferencial antes de investir em campanha
Alcance baixo → diversificar canais ou aumentar tráfego onde já converte
Conversão baixa → melhorar copy e oferta, não volume de anúncios
Consistência baixa → criar fluxo de conteúdo sistemático, não campanhas pontuais

Ordem estratégica:
1. Diagnosticar o gargalo real — não assumir a causa, investigar
2. Agir sobre o gargalo específico, não sobre tudo ao mesmo tempo
3. Testar a solução em escala pequena antes de escalar
4. Medir resultado e iterar

Módulos como ferramentas de execução (dependendo do gargalo):
Validar Produto — gargalo de oferta: confirmar se o produto ainda tem demanda na forma atual
Criar Campanha — gargalo de conversão: melhorar copy e estrutura do anúncio
Criar Conteúdo — gargalo de consistência: criar fluxo de conteúdo sistemático
Gerador Criativo — gargalo de criativo: testar novos conceitos visuais

Resultado esperado: crescimento baseado no gargalo real identificado — não crescimento genérico com mais do mesmo`,
    relatedTopics: [
      "validate-products",
      "create-campaign",
      "create-content",
    ],
  },
];
