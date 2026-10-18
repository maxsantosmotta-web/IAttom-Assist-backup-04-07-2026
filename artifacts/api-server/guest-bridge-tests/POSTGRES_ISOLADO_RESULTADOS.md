# Validação PostgreSQL isolada — sem produção

**Resultado confirmado:** 10/10 testes executados com PGlite, mecanismo PostgreSQL 17.5 compilado para WebAssembly, em diretórios temporários isolados. Nenhum serviço pago nem banco, usuário, crédito, assinatura ou dado real do IAttom Assist foi consultado ou modificado.

Reproduzir isoladamente neste diretório: `npm install --ignore-scripts && npm run test:postgres`.

Arquivos:
- `ISOLATED_POSTGRES_TEST_SCHEMA.sql` contém as tabelas fictícias `guest_test_users`, `guest_test_paid_purchases` e `guest_test_general_grants`, incluindo UNIQUE na sessão e assinatura e na chave da concessão.
- `isolatedPostgresClaims.test.mjs` testa START (200 créditos gerais), PREMIUM (500) e PRO (1000), retransmissões da mesma compra, conflito de titularidade Clerk, compra paga ainda sem conta, compra duplicada enviada para revisão, rollback e persistência ao reiniciar o banco local.

**Importante:** o campo `server_paid_verified` é criado apenas pelo código de teste como uma condição simulada; NÃO comprova pagamento Stripe, nem deve ser exposto a um cliente. A tabela é didática e não corresponde a uma migração pronta do banco oficial.

**Limites desta etapa:** PGlite usa conexão local única; não valida concorrência real com vários workers/serviços em um PostgreSQL externo. Os testes NÃO executam `handleCanonicalSubscriptionChange` no banco oficial, não verificam tokens reais do Clerk nem recebimento autenticado de webhook Stripe. Não representam checkout operacional.

**Antes de qualquer liberação real:** implementar idempotência durável e integridade das concessões dentro do MESMO PostgreSQL da rotina canônica, validar corrida de trabalhadores em Postgres de teste separado, validar eventos do Stripe e e-mail primário verificado do Clerk em ambiente autorizado; preparar reprocessamento após crash e manter compras pagas sem vinculação em revisão em vez de cancelá-las. O adaptador atual `COMMERCIAL_GUEST_WRITE_RELEASED = false` continuará imutável até autorização explícita.

Não executar o esquema de testes sobre `DATABASE_URL` de produção. Nenhuma cobrança live foi ativada.