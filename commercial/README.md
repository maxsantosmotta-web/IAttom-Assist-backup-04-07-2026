# IAttom Assist — página comercial (trabalho isolado)

Este diretório será a página de vendas independente do aplicativo principal, prevista para `oferta.iattomassist.com.br`.

## Fluxo aprovado

Anúncio → Saiba Mais → página comercial → escolha do plano → checkout Stripe sem cadastro → pagamento confirmado → cadastro Clerk com o **mesmo e-mail verificado** → associação segura da assinatura → dashboard.

## Regras de implementação

- O comprador deve pagar antes de criar uma conta.
- O checkout de visitante será **novo**; não substituir a rota autenticada `/stripe/checkout`.
- Preços e IDs de preços devem ser obtidos do servidor, nunca confiados ao navegador.
- A assinatura só pode ser vinculada após confirmação do Stripe e verificação da titularidade do e-mail no Clerk.
- A associação deve ser idempotente e impedir reutilização da mesma assinatura por outra conta.
- Considerar compra concluída sem cadastro imediato, repetição de webhooks, chargebacks e cancelamentos.
- Não solicitar CPF nem acrescentar campos ao cadastro.
- Aviso visível: **Use no cadastro o mesmo e-mail informado no pagamento.**
- Vídeo institucional poderá ser incluído depois.
- Manter o aplicativo e o faturamento atual intactos até validação completa em ambiente de teste.

## Estado

Repositório analisado: o checkout atual cria sessão com `customer` de usuário existente e exige `requireAuth`. A reconciliação atual depende de `clerkUserId`, logo não pode ser reutilizada diretamente por um visitante.

Este documento registra o escopo; **não representa checkout implementado, testado ou publicado**.
