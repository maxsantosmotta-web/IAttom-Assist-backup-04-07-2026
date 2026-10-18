# Conexão REAL, somente leitura, landing → API oficial IAttom Assist

Feita em 17/10/2026, na branch isolada comercial. URL fixa: https://workspaceiattom-assist-production.up.railway.app/api/stripe/plans. Não requer chaves, conta Stripe ou escrita no financeiro oficial.

Para cada clique START/PREMIUM/PRO, o servidor da landing envia um GET à API pública REAL do sistema em produção (não é mock). Confere a existência dos três planos, planKey, nome, Price ID, valor BRL mensal e créditos gerais oficiais START=200, PREMIUM=500, PRO=1000. Qualquer desvio, HTTP !=200, falha de rede, JSON inválido, conteúdo excessivo e catálogo ambíguo interrompem a preparação. Só o servidor faz a consulta. O navegador não escolhe preço nem endpoint.

GET /api/official/catalog-status retorna verificado=true e planos/Price IDs/créditos quando a comunicação REAL está correta. Este endpoint não autentica nem revela registros de clientes. POST /api/stripe/official-checkout valida primeiro o pré-cadastro do próprio servidor e depois o catálogo oficial, e retorna confirmação do plano ainda SEM URL de pagamento. A criação real de sessão Stripe permanece com constantes de liberação false e serverRegistrationProofVerified false.

Este é um elo funcional REAL e verificável do backend em produção para a landing, mas NÃO é ainda a ponte de assinatura paga ao Clerk ou aos créditos do usuário. Essas etapas exigem integração autenticada no backend PostgreSQL oficial, com aprovação antes de qualquer modificação de dados.

Dados ativos na API pública consultada: START pro R$69 / 200 créditos / price_1TunJ2AYtu5nLhAZPd1Ai0hD; PREMIUM business R$159 / 500 / price_1TunQhAYtu5nLhAZu5QXWW31; PRO agency R$299 / 1000 / price_1TunTDAYtu5nLhAZDfzTn8Cm. Créditos criativos não estão informados nessa API; não inventar nem alterar.

Sem alterações em main, Clerk, Stripe, Postgres ou assinaturas. Checkout real indisponível até autorização posterior.