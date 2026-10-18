# Ponte persistente da compra guest (somente protótipo)

Data: 17/10/2026. Nenhum código oficial, migração de banco ou pagamento alterado.

Implementado um banco SQLite LOCAL de teste com constraints UNIQUE para checkout, subscription, Customer, pré-cadastro e usuário Clerk.

Estados PENDING -> LEASED -> DONE, tratamento RETRYABLE, exclusividade de lease, expiração, retomada, e bloqueio do worker antigo com token aleatório.

O resultado do pré-verificador read-only passa a incluir o registrationId originado no servidor. O protótipo nunca concede créditos e só aceita recibos de SIMULAÇÃO.

O SQL PostgreSQL ao lado é APENAS proposta e termina em ROLLBACK.

PENDENTE PARA PRODUCAO: interfaces reais de Clerk/Stripe, transação única com unicidade e row lock no PostgreSQL, vínculo de Customer/assinatura/metadata após comprovação, grants via rotina canônica existente, índice UNIQUE do identificador de concessão, reconciliação/retry após crash, políticas de créditos e compatibilidade Google Play.

Atencao: o preflight em objeto JavaScript pode ser falsificado por um chamador; seu uso real deve ser interno ao servidor e os dados devem ser obtidos dos provedores, nunca do navegador.

Faltam corrigir reassociação por /auth/sync e cancelamento legado de assinaturas no código oficial. Nenhuma alteração nesses pontos nesta etapa.

Não habilitar o pagamento real até esta ponte ser implementada e autorizada no backend oficial.