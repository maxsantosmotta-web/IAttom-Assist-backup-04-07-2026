# Pré-verificação realista da ponte Clerk–Stripe–financeiro

Etapa em isolamento. O arquivo commercial-preflight-readonly.mjs oferece um orquestrador read-only que usa adaptadores de consulta em serviços confiáveis. Não está montado em nenhuma rota pública, não possui chaves Stripe nem Clerk, não concede créditos, não ativa plano.

Fluxo: identificador Clerk da autenticação do servidor → busca identidade e e-mail verificado no Clerk → busca sessão diretamente no Stripe e exige pagamento completo → busca pré-cadastro diretamente no banco de pré-registros por client_reference_id + metadata, cujo e-mail deve corresponder ao Clerk → confere Customer, Subscription, Invoice, Price ID, valor, BRL, periodicidade → verifica a linha de usuário já existente e possível titularidade de terceiros → verifica outra assinatura Stripe ou Google Play ativa → retorna apenas READY para futura reivindicação, SEM escrita.

START price_1TunJ2AYtu5nLhAZPd1Ai0hD → pro; PREMIUM price_1TunQhAYtu5nLhAZu5QXWW31 → business; PRO price_1TunTDAYtu5nLhAZDfzTn8Cm → agency. Valores em centavos: 6900, 15900, 29900, respectivamente.

Importante: cada adapter ainda é fictício nos testes. Esta execução NÃO verificou registros reais no Stripe nem identificou conexão Clerk; não chamou contas externas. Sem implantação e configuração dos adaptadores reais, isto não sincroniza assinaturas.

O preflight não é autorização de pagamento, não altera Stripe Metadata e não prova atomicidade SQL. O passo posterior exigirá POST autenticado da plataforma, material confiável de sessão, claim persistente em banco com exclusividade por session / subscription / customer / user, lock transacional, preservação dos direitos existentes, retry seguro com webhook, recuperação de falhas, e chamar só o grant canônico uma vez após reconciliação e aprovação da política de créditos.

PROBLEMAS pré-existentes a resolver antes de qualquer ativação: /auth/sync recebe e-mail de browser e getOrSyncUser pode reassociar clerkId; endpoint /stripe/reconcile-session exige client_reference_id = clerkUserId, diferente do guest checkout; webhook de subscription.deleted usa implementação legada que zera créditos; tabela de transações não declara unicidade de stripeSessionId; PLAN_CREDITS da rota de apresentação diverge da função de grant; a rotina canônica atual concede zero créditos criativos. Não alterar produção sem aprovação.

Em caso de e-mail do Clerk diferente do pré-cadastro, preservar compra e encaminhar para revisão segura. O e-mail do pagador no Stripe não é identidade da conta. Conflitos de Customer / Subscription / Google Play não substituem contas preexistentes.