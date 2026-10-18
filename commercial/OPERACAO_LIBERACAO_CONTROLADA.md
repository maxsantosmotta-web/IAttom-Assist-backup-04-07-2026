# Preparação de ativação comercial — IAttom Assist

A versão candidata NÃO ativa cobrança real nem modifica dados de clientes ao ser compilada. A aprovação definitiva de implantação e de uso de pagamentos reais é uma decisão separada.

## Pré-requisitos operacionais
- Aplicar somente após revisão e autorização a migração SQL aditiva em `lib/db/sql/20261018_commercial_guest_claims.sql`, no banco correto, com backup confirmado. **NÃO executá-la automaticamente pela pipeline.**
- Garantir que a URL pública HTTPS oficial da landing, sob domínio `iattomassist.com.br`, esteja provisionada e tenha DNS/certificado válidos. A prévia Railway não é destino aceito para compra real.
- Garantir que o frontend tenha proxy `/api` apontando para backend correto com a rota `/api/stripe/guest/claim`.
- Compartilhar `COMMERCIAL_REGISTRATION_HMAC_KEY` com backend e landing, sem exibir/registrar o valor.
- Verificar `STRIPE_LIVE_SECRET_KEY` na landing, `STRIPE_SECRET_KEY` no SaaS e a assinatura do webhook Stripe no backend, antes de permitir qualquer cobrança.
- Preservar preços e mapeamentos existentes; não criar produtos ou compras para verificar o fluxo.

## Chaves de liberação (sempre ausentes/desligadas por padrão)

**Backend IAttom:**
- `IATTOM_COMMERCIAL_OPERATOR_APPROVED=true`
- `IATTOM_COMMERCIAL_CLAIM_RELEASED=true`
- `IATTOM_COMMERCIAL_CAPTURE_RELEASED=true`
- `COMMERCIAL_GUEST_CLAIM_ENABLED=true`
- `COMMERCIAL_REGISTRATION_HMAC_KEY` conforme a chave partilhada.

**Landing comercial:**
- `IATTOM_COMMERCIAL_OPERATOR_APPROVED=true`
- `IATTOM_COMMERCIAL_CHECKOUT_RELEASED=true`
- `IATTOM_COMMERCIAL_BRIDGE_READY=true`
- `IATTOM_COMMERCIAL_PAYMENT_AUTHORIZED=true`
- `COMMERCIAL_LANDING_PUBLIC_ORIGIN` (HTTPS e domínio próprio; não apontar para a prévia)
- `COMMERCIAL_REGISTRATION_HMAC_KEY` e `STRIPE_LIVE_SECRET_KEY` conforme segredos autorizados.

**Regra:** não ligar a landing antes de confirmar backend implantado, tabela SQL e webhooks reais, com recuperação segura da compra. Qualquer variável ausente mantém seu componente bloqueado.

## Rollback operacional
1. Desligar imediatamente `IATTOM_COMMERCIAL_CHECKOUT_RELEASED` ou `IATTOM_COMMERCIAL_PAYMENT_AUTHORIZED` na landing para impedir novas compras.
2. Manter o backend de captura/reconciliação ligado até decidir com segurança o destino das compras já pagas. Desligar o claim não reembolsa nem cancela compras.
3. Não apagar `commercial_guest_claims` nem zerar créditos de usuários durante rollback.
4. Reverter código por deploy da versão anterior com plano de recuperação de compras pendentes; analisar logs e status do journal.
