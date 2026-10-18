# Ponte externa Stripe / Clerk — backend isolado

**Esta branch não é produção.** Não contém deploy autorizado, banco de testes conectado ou cobrança real liberada.

## Contrato concluído em código
Os módulos `src/lib/guestCommercialProof.ts`, `guestCommercialPolicy.ts`, `guestCommercialClaim.ts` e `src/routes/guestCommercial.ts` usam o `session_id` de um Checkout de assinatura pago, metadados HMAC assinados pela landing e e-mail principal verificado no Clerk. O e-mail B do pagador não é exigido como igual ao e-mail A de pré-cadastro.

START -> `price_1TunJ2AYtu5nLhAZPd1Ai0hD` -> `pro` -> 200 créditos gerais.
PREMIUM -> `price_1TunQhAYtu5nLhAZu5QXWW31` -> `business` -> 500 créditos gerais.
PRO -> `price_1TunTDAYtu5nLhAZDfzTn8Cm` -> `agency` -> 1000 créditos gerais.

**Trava permanente nesta branch:** `COMMERCIAL_GUEST_WRITE_RELEASED: boolean = false`, antes de qualquer acesso a Stripe, Clerk ou PostgreSQL na função de claim. Nenhuma variável de ambiente libera pagamentos ou créditos.

## Validação reproduzível
No workspace com dependências disponíveis, executar `npx tsx --test artifacts/api-server/guest-bridge-tests/guestProofPolicy.test.mjs`. Também foi realizada uma verificação TypeScript dos cinco arquivos do adaptador e middleware com as versões de `stripe@22.1.0`, `@clerk/express@2.1.12`, `express@5.1.0`, `drizzle-orm@0.44.7` e declarações substitutas limitadas para `@workspace/db` e a função canônica. Essa checagem local passou; **não equivale ao typecheck/build completo do monorepo**.

Correção de tipagem executada: a versão Stripe em uso não declara `invoice.paid` no objeto Invoice; a prova usa `invoice.status === 'paid'`, além de ID, customer, assinatura e montante.

## Antes de uma implantação real
1. Homologar build completo do backend isolado com dependências e PostgreSQL de teste sem dados de usuários.
2. Implementar e auditar unicidade persistente de reconciliação de sessão, assinatura e concessões por período antes de qualquer ativação.
3. Validar assinatura HMAC compartilhada somente entre backends, pré-cadastro A e e-mail principal Clerk C com URL e credenciais de teste; nunca exigir que o e-mail B do pagador seja igual.
4. Preservar outras assinaturas, Google Play e créditos existentes; revisar cancelamentos legados e associação de contas.
5. Obter autorização explícita do proprietário para qualquer migração, credencial, cobrança live ou deploy oficial.

## Segurança
Não criar novos Price IDs; não incluir chaves secretas em código ou documentação; não apontar o ambiente isolado para o PostgreSQL ou Clerk administrativos de produção. A landing comercial mantém os pagamentos reais desligados.