# Auditoria preventiva e trilho de integracao comercial — 17/10/2026



ESCOPO: apenas codigo fonte e metadados Railway, sem acessar clientes, banco, Clerk ou Stripe oficial. Este arquivo pertence exclusivamente a branch comercial e NAO autoriza deploy ou alteracao de producao.



REFERENCIA CONFIRMADA: repositorio maxsantosmotta-web/IAttom-Assist-backup-04-07-2026. Ultimo deployment SUCCESS consultado para Railway production @workspace/api-server: ec45246307ef9ca27f988450bea37055cb83665a. Main na consulta: f1f9ffe4e415c74a738dee08669346d4a832c5d1, marcado como SKIPPED para esse servico. Conferir servico e commit novamente antes de qualquer intervencao.



REGRA DE PRODUTO: A = email do pre-cadastro, B = email do pagador Stripe, C = email verificado no Clerk. Pagamento aceita B diferente de A. Acesso futuro exige C igual a A e pagamento Stripe confirmado; C divergente mantem o pagamento registrado com acesso pendente. Cartao de terceiro autorizado e permitido.



RISCO P0 — IDENTIDADE. Em artifacts/api-server/src/routes/authRoutes.ts, /auth/sync chama getOrSyncUser com email vindo do corpo validado da requisicao. Em artifacts/api-server/src/lib/userSync.ts, getOrSyncUser pode reassociar o clerkId de um registro localizado por email. Exigir email verificado pelo servidor Clerk e bloquear reassociacao de registro pertencente a outro Clerk. Revisar onboarding e OTP para nao interromper usuarios existentes.



RISCO P0 — CANCELAMENTO. Em artifacts/api-server/src/lib/webhookHandlers.ts, o evento customer.subscription.deleted aciona o handler legado handleSubscriptionDeleted, que rebaixa plano e creditos a FREE. Existe handleCanonicalSubscriptionDeleted em artifacts/api-server/src/lib/stripeCanonicalSubscription.ts com revisao de outras assinaturas, mas nao e o handler invocado nesse ramo. Investigar coexistencia de contratos antes de migrar webhook e preservar saldos extras.



RISCO P0 — DUPLICIDADE E CONCORRENCIA. Em lib/db/src/schema/users.ts, stripe_customer_id e stripe_subscription_id nao possuem unique declarado; em lib/db/src/schema/creditsTransactions.ts, stripe_session_id nao possui unique declarado. O credito canonico consulta historico dentro de transacao, mas o schema nao mostra uma restricao unica impeditiva de execucoes concorrentes. O banco real PODE ter indices criados por migracoes fora do schema; validar somente leitura antes de tirar conclusao. Auditar colisoes historicas ANTES de qualquer indice ou migracao.



RISCO P1 — MAPA DE PLANOS. Landing vende START R$69, PREMIUM R$159, PRO R$299 com mapa provisório pro/business/agency. A rota Stripe oficial exibe planos com nomes, valores e franquias divergentes. Confirmar precos autorizados, produtos Stripe, limites de creditos e compatibilidade antes de pagamentos live. Nao reutilizar valores experimentais de centavos do stripe-upgrade-test.



RISCO P1 — GOOGLE PLAY E CLIENTES EXISTENTES. A rota artifacts/api-server/src/routes/googlePlaySubscriptionEntitlements.ts tambem concede plano/creditos. Nova ponte nao pode substituir contrato valido desse canal ou assinatura Stripe preexistente. Cancelamento, substituicao, upgrade e reembolso exigem roteiro isolado.



ARQUIVOS PREVISTOS (PROPOSTA, NENHUM ALTERADO):

1. Novo artifacts/api-server/src/routes/commercialClaim.ts — reivindicacao POS-LOGIN, protegida pelo Clerk autenticado; sem confiar no email do navegador.

2. Novo artifacts/api-server/src/lib/commercialClaimService.ts — valida comprovante do pre-cadastro enviado entre servidores, sessoes, customer, subscription e invoice Stripe, titularidade e idempotencia.

3. Novo lib/db/src/schema/commercialClaims.ts mais migracao ADITIVA para claims, registro de revisao e unicidade por Checkout e assinatura; auditar banco antes de indices extras em usuarios/creditos.

4. artifacts/api-server/src/routes/index.ts — registro da rota nova por FEATURE FLAG desligada por padrao.

5. artifacts/api-server/src/lib/userSync.ts e routes/authRoutes.ts — prevencao de reivindicacao indevida de e-mail e verificacao Clerk, com testes de regressao.

6. artifacts/api-server/src/lib/webhookHandlers.ts e lib/stripeCanonicalSubscription.ts — revisao do delete legado e manutencao do reconciliador canonico de creditos.

7. Interface pos-login a identificar — estado de assinatura pendente e correcao segura, SEM modificar o fluxo atual de login Clerk.

8. commercial/server.mjs — futura entrega autenticada entre servidores; jamais embutir chaves Stripe/Clerk ou token fixo em JavaScript publico.



ACOPLAMENTO: a atual rota /stripe/reconcile-session exige client_reference_id igual ao Clerk user id, enquanto o checkout visitante da landing usa registrationId. Ela NAO deve ser reutilizada diretamente sem prova de titularidade; construir caminho separado e seguro. Utilizar o financeiro existente apenas apos vinculo autenticado e confirmacao de fatura.



SEQUENCIA DE DEPLOY FUTURO: (a) checar commits em execucao e backup restauravel; (b) auditar indices e duplicatas de banco em leitura; (c) confirmar mapa de planos e creditos; (d) testar ponte nova com simulacoes de concorrencia, duplicacao, expiracao, cancelamento, Google Play e email A/B/C; (e) migracao aditiva com esquema compatível; (f) publicar com feature flag OFF; (g) autorizar canario e monitorar; (h) ampliar somente apos validacao.



REVERSAO: desligar flag impede novos claims; rollback de codigo deve preservar o esquema aditivo compatível. NUNCA apagar claims nem desfazer creditos e pagamentos automaticamente: erros financeiros pedem ajustes rastreaveis autorizados. Backup deve ter teste de restauracao, nao somente promessa de backup.



GUARDAS ISOLADOS: commercial/official-bridge-guards.mjs e tests/official-bridge-guards.test.mjs sao apenas funcoes puras com dados sintéticos. Elas NAO chamam sistemas oficiais, NAO registram transacao, NAO ativam conta e NAO significam que a integracao esteja pronta.