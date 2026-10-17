# IAttom Assist — landing comercial isolada

## Trilho operacional aprovado

Anúncio → Saiba Mais → landing comercial → **pré-cadastro obrigatório de e-mail, com salvamento real** → escolha do plano → checkout Stripe de visitante (mesmo e-mail) → pagamento confirmado por webhook → criação de conta Clerk com o **mesmo e-mail verificado** → associação segura da assinatura → dashboard.

O pré-cadastro não é lista de espera, acesso antecipado, conta definitiva ou autorização para liberar plano. Ele serve para registrar o endereço que será usado na compra e no cadastro definitivo.

**Aviso obrigatório:** o e-mail do pré-cadastro deve ser o mesmo e-mail do pagamento e do cadastro definitivo.

## Planos comerciais

- Start: R$ 69,00/mês
- Premium: R$ 159,00/mês
- Pro: R$ 299,00/mês

Não incluir plano Free nem quantidade de créditos nos cards.

## Implementado nesta branch

- Landing premium preto/dourado, reorganizada para apresentar o pré-cadastro **antes dos planos**.
- Apenas e-mail no pré-cadastro. Sem exigir nome, CPF ou WhatsApp.
- Endpoint `POST /api/pre-register`: valida, normaliza e armazena o e-mail com um identificador de pré-cadastro em arquivo persistido no volume exclusivo do projeto de preview, sem qualquer conexão ao banco de produção.
- Validação mínima de origem, tamanho e frequência das requisições e campo anti-bot.
- Capturas reais de seis telas da plataforma, servidas como sprite WebP de baixa resolução, empacotadas em `assets/screens.b64.1..5`. Uma imagem em seis segmentos evita alojamento externo e mantém a landing autônoma. Melhorar resolução depois que o layout for aprovado.
- Seleção dos três planos disponível **somente após** sucesso do registro do e-mail. Não efetua cobranças na prévia.
- Área reservada a vídeo vertical institucional.

## Ambiente de testes isolado

- Railway project: `iattom-landing-preview` (`955d9d36-f1c6-49ee-ab17-fb3baf97b14e`)
- Ambiente: `preview`
- Serviço: `landing-comercial-preview`
- URL: https://landing-comercial-preview-preview.up.railway.app/
- Repositório: `maxsantosmotta-web/IAttom-Assist-backup-04-07-2026`
- Branch: `feature/landing-vendas-stripe-pre-cadastro`
- Root directory: `/commercial`
- Volume exclusivo: `iattom-preview-leads-only`, montado em `/data`.

## Ainda NÃO implementado — proibido fingir que está pronto

- Checkout real de visitante Stripe, com IDs de preço obtidos do servidor; **não reutilizar nem substituir** a rota autenticada `/stripe/checkout`.
- Vínculo pós-pagamento e conciliação com Clerk por e-mail **verificado**, confirmado pelo Stripe, nunca pela mera coincidência de texto digitado.
- Webhook idempotente, prevenção de associação duplicada, cancelamentos, reembolsos e pagamentos feitos sem cadastro imediato.
- Envio dos eventos de pré-cadastro para um backend definitivo seguro (na prévia os registros ficam isolados).
- Testes de ponta a ponta e de conformidade de privacidade antes de lançar pagamentos reais.

## Blindagem obrigatória

Não modificar `main`, o domínio oficial `iattomassist.com.br`, serviços e banco de produção, checkout autenticado, Clerk existente ou configurações de faturamento em produção. Não utilizar Replit. Publicações e testes ocorrem somente no projeto Railway isolado.

## Desenvolvimento

O serviço Node (sem dependências externas) inicia por `npm start`; serve a página `index.html`, o sprite `/assets/screens.webp` e o endpoint `/api/pre-register`. O arquivo de pré-cadastro é `/data/pre-registrations.jsonl`. Em ambiente local, configurar `PRE_SIGNUP_DATA_DIR` para um caminho temporário; não criar arquivos reais de clientes no repositório.

## Oito capturas recriadas — alta definição

As oito imagens geradas pelo usuário na conversa (Módulos, Buscar, Validar, Campanha, Conteúdo, Imagem, Vídeo com Efeito, Biblioteca) estão em área de mídia independente, protegendo produção. No primeiro GET a cada imagem, o servidor do Railway prévia baixa o PNG de fonte permitida, valida assinatura/tamanho, salva no volume isolado `/data/landing-images` e entrega ao navegador com URL local `/assets/landing/<nome>.png`. Substitui o antigo sprite desfocado, que não é mais usado pelo HTML. As artes são recriações nítidas de telas do IAttom, não capturas de sistema em execução.


## Stripe isolado — preparação de integração em modo de teste (17/10/2026)

O projeto comercial possui endpoints **novos**, sem reutilizar ou editar as rotas Stripe do aplicativo:
- `GET /api/stripe/test-status`: informa apenas se o teste está preparado, nunca expõe segredo.
- `POST /api/stripe/test-checkout`: recebe SOMENTE `{registrationId, plan}` e recupera o e-mail autoritativo do pré-cadastro persistente; jamais aceita o e-mail enviado pelo navegador como fonte do checkout.

**Estado padrão: DESABILITADO.** Nenhuma variável de Stripe está configurada atualmente no Railway de preview; selecionar um plano continua sem pagamento. Para habilitar SOMENTE neste serviço e ambiente isolado, configurar:
- `STRIPE_TEST_CHECKOUT_ENABLED=true`
- `STRIPE_TEST_SECRET_KEY=sk_test_...` (credencial criada no modo de teste)
- `STRIPE_TEST_PRICE_START=price_...` (mensal BRL 69,00)
- `STRIPE_TEST_PRICE_PREMIUM=price_...` (mensal BRL 159,00)
- `STRIPE_TEST_PRICE_PRO=price_...` (mensal BRL 299,00)

Proteções: exige mesma origem de requisição, identificador de pré-cadastro armazenado, consulta preços à API Stripe e valida `livemode=false`, preço ativo, BRL, valor exato e ciclo mensal; usa somente segredo `sk_test_`; cria Customer **de teste** com e-mail registrado (que fica travado no Stripe Checkout quando preenchido), idempotência na criação do Customer, Checkout Session com `mode=subscription` e `cs_test_`; registra referências para futura reconciliação e permite redirecionamentos apenas para `checkout.stripe.com` e retorno para a landing isolada.

Com as variáveis ausentes, o botão mantém o comportamento anterior. Somente se o teste estiver habilitado, o botão muda para **"Testar checkout"** e abre Stripe TESTE. Nenhum código desta branch atualiza assinaturas do SaaS; **não há webhook nem liberação de acesso**, e o retorno do Stripe nunca é tratado como prova de pagamento. Vinculação definitiva exigirá validação de pagamento por webhook, e-mail verificado via Clerk e revisão antes de permitir produção.

**Não reutilizar secret/price IDs de produção. Não configurar nada no Railway principal.**


## Eventos de pagamento simulados, sem compra real

- Adicionado `stripe-test-event.mjs` com verificação HMAC do cabeçalho `Stripe-Signature` (janela de cinco minutos) e avaliação vinculada a sessão, valor BRL, plano e e-mail pré-cadastrado.
- Checkout no modo teste persiste referências de sessão em `/data/stripe-test-sessions.jsonl`; webhook guarda decisões idempotentes em `/data/stripe-test-events.jsonl`.
- `POST /api/stripe/test-webhook` permanece **desativado** sem `STRIPE_TEST_WEBHOOK_ENABLED=true` e `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`, além da configuração Stripe de teste existente.
- `npm test` executa casos automatizados com dados inventados, assinatura HMAC local, pagamentos aprovados, pendentes, falhados e expirados, evento duplicado, adulteração de dados, uma solicitação HTTP real local e checagem lógica de identidade Clerk verificada.
- Esses eventos NÃO ativam assinatura, NÃO escrevem em bancos do SaaS e NÃO acionam Clerk. Não constituem integração Stripe/Clerk ponta a ponta real.
- Para receber webhooks reais de teste, configurar as variáveis **apenas na landing isolada** e cadastrar o endpoint de webhook no Stripe em modo TESTE, sem tocar no checkout autenticado do IAttom Assist.
