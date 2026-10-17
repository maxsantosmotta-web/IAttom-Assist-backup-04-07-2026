# Auditoria de valores reais — IAttom Assist — 17/10/2026



PLANOS COMERCIAIS DA LANDING (valores existentes, sem alteração):

START = R$ 69,00/mês = 6900 centavos BRL → chave interna PROVISÓRIA pro.

PREMIUM = R$ 159,00/mês = 15900 centavos BRL → chave interna PROVISÓRIA business.

PRO = R$ 299,00/mês = 29900 centavos BRL → chave interna PROVISÓRIA agency.

ALERTA: o PRO da landing não é a chave pro do backend.



FONTES ANALISADAS:

1. Landing comercial: valores 69/159/299 e contrato do teste 6900/15900/29900. Aprovação de publicação comercial real ainda pendente.

2. Último código implantado com sucesso do serviço oficial @workspace/api-server: commit ec45246307ef9ca27f988450bea37055cb83665a. A rota /stripe/plans tem PLAN_PRICES com inteiros 7900/19900/49900 para pro/business/agency mas retorna currency usd; não representa os valores aprovados da landing.

3. Ambiente stripe-upgrade-test: endpoint GET /api/stripe/plans devolve START/PREMIUM/PRO com amount 50, currency brl, equivalentes a R$0,50 de testes financeiros anteriores. NÃO são preços para novos clientes e não devem ser reaproveitados.

4. Endpoint GET oficial iattomassist.com.br/api/stripe/plans não pôde ser lido nesta execução (fetch failed). Não foi possível consultar diretamente a API Stripe live; não há confirmação de price IDs reais nos valores comerciais pretendidos.



CRÉDITOS EM DESACORDO NO CÓDIGO OFICIAL:

A rotina canonical de concessão utiliza lib/credits.ts com gerais pro=200, business=500, agency=1000. Esse arquivo também declara limites criativos pro=100, business=150, agency=250; a função handleCanonicalSubscriptionChange analisada registra creativeGranted=0 e só concede créditos gerais.

A rota de apresentação routes/stripe.ts exibe totais gerais diferentes: pro=500, business=2000 e agency=10000. NENHUMA alteração de franquia deve ocorrer sem aprovação explícita.



GUARD DE VALORES: commercial/real-price-contract.mjs exige fonte Stripe live autenticada (no futuro), conta Stripe oficial verificada, produto ativo, IDs únicos, preços ativos em BRL, valores EXATOS em centavos, cobrança a cada um mês e correspondência interna da metadata do produto. Mesmo após comparar todos os preços com sucesso, devolve checkoutPermitted=false: é SOMENTE um simulador sem rede, sem pagamento e sem acesso a produção.



ANTES DE LIBERAR UM CHECKOUT REAL:

- Confirmar em consulta de leitura no painel Stripe oficial a existência ou não de três Price IDs live por 6900, 15900 e 29900 centavos BRL / mês; conferir a mesma conta Stripe.

- Aprovar os nomes comerciais e chaves internas, sem presumir que o endpoint antigo representa a nova oferta.

- Aprovar explicitamente a política de créditos gerais e criativos, renovação e limites por plano.

- Não criar Stripe Prices nem ativar checkout sem autorização. Se valor live divergir, apresentar divergência ao usuário e aguardar decisão.

- Manter feature flag OFF por padrão, auditoria e plano de reversão; nada disso está implementado em produção.