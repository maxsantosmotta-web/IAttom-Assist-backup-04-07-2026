# IAttom Assist — landing comercial isolada

## Trilho operacional aprovado

Anúncio → Saiba Mais → landing comercial → **pré-cadastro obrigatório de e-mail, com salvamento real** → escolha do plano → checkout Stripe de visitante (e-mail de pagamento livre) → pagamento confirmado por webhook → criação de conta Clerk com o **mesmo e-mail verificado** → associação segura da assinatura → dashboard.

O pré-cadastro não é lista de espera, acesso antecipado, conta definitiva ou autorização para liberar plano. Ele serve para registrar o endereço que será usado na compra e no cadastro definitivo.

**Regra:** o e-mail verificado no Clerk deve corresponder ao pré-cadastro, mas o e-mail do pagador e titular do cartão podem ser diferentes.

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

Proteções: exige mesma origem de requisição, identificador de pré-cadastro armazenado, consulta preços à API Stripe e valida `livemode=false`, preço ativo, BRL, valor exato e ciclo mensal; usa somente segredo `sk_test_`; não trava o e-mail de pagamento nem cria antecipadamente o Customer Stripe; o Checkout cria automaticamente o Customer e seu ID é registrado após webhook assinado, Checkout Session com `mode=subscription` e `cs_test_`; registra referências para futura reconciliação e permite redirecionamentos apenas para `checkout.stripe.com` e retorno para a landing isolada.

Com as variáveis ausentes, o botão mantém o comportamento anterior. Somente se o teste estiver habilitado, o botão muda para **"Testar checkout"** e abre Stripe TESTE. Nenhum código desta branch atualiza assinaturas do SaaS; **não há webhook nem liberação de acesso**, e o retorno do Stripe nunca é tratado como prova de pagamento. Vinculação definitiva exigirá validação de pagamento por webhook, e-mail verificado via Clerk e revisão antes de permitir produção.

**Não reutilizar secret/price IDs de produção. Não configurar nada no Railway principal.**


## Eventos de pagamento simulados, sem compra real

- Adicionado `stripe-test-event.mjs` com verificação HMAC do cabeçalho `Stripe-Signature` (janela de cinco minutos) e avaliação vinculada a sessão, valor BRL, plano e e-mail pré-cadastrado.
- Checkout no modo teste persiste referências de sessão em `/data/stripe-test-sessions.jsonl`; webhook guarda decisões idempotentes em `/data/stripe-test-events.jsonl`.
- `POST /api/stripe/test-webhook` permanece **desativado** sem `STRIPE_TEST_WEBHOOK_ENABLED=true` e `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`, além da configuração Stripe de teste existente.
- `npm test` executa casos automatizados com dados inventados, assinatura HMAC local, pagamentos aprovados, pendentes, falhados e expirados, evento duplicado, adulteração de dados, uma solicitação HTTP real local e checagem lógica de identidade Clerk verificada.
- Esses eventos NÃO ativam assinatura, NÃO escrevem em bancos do SaaS e NÃO acionam Clerk. Não constituem integração Stripe/Clerk ponta a ponta real.
- Para receber webhooks reais de teste, configurar as variáveis **apenas na landing isolada** e cadastrar o endpoint de webhook no Stripe em modo TESTE, sem tocar no checkout autenticado do IAttom Assist.

## Auditoria de compatibilidade financeira — segurança da landing

A análise em modo somente leitura do código main mostrou que o endpoint existente /api/stripe/checkout exige autenticação Clerk (requireAuth). A função ensureStripeCustomer requer previamente um usuário no banco do IAttom. A reconciliação oficial reconhece uma assinatura pelo cliente Stripe associado ao Clerk ou pela metadata clerkUserId. A compra da landing ANTES de criar conta não pode usar diretamente esse endpoint, nem ativar acesso por coincidência de e-mails.

O ambiente stripe-upgrade-test apresenta nomes START / PREMIUM / PRO associados a chaves internas do legado pro / business / agency, porém os preços observados nesse ambiente são experimentais de centavos. O arquivo official-compatibility.mjs documenta esta associação PROVISÓRIA somente para simulações, mantendo na landing R$69, R$159 e R$299. A associação definitiva deve ser conferida antes de habilitar pagamentos reais.

O checkout isolado de testes inclui subscription_data.metadata.planKey PROVISÓRIA para verificar compatibilidade com o código financeiro existente. O stub da API Stripe rejeita chaves internas incompatíveis. A simulação assessGuestCheckoutHandoff bloqueia e-mails Clerk não verificados, pagamentos não confirmados, associação divergente e assinatura duplicada. Mesmo quando elegível, accountActivated é sempre false e a situação é PENDING_OFFICIAL_RECONCILIATION.

PENDENTE: construção, revisão e autorização explícita de ponte autenticada no backend oficial para associar a compra como visitante à conta Clerk após pagamento validado, garantindo cliente Stripe correto e prevenção de assinaturas duplicadas. Nenhuma mudança foi realizada no código main, no Clerk real, nas credenciais de produção ou no banco do IAttom.

## Fila durável de pendências de associação Clerk (somente testes)

O webhook assinado em modo Stripe TESTE armazena um pré-vínculo em /data/stripe-test-handoffs.jsonl, inicialmente WAITING_VERIFIED_CLERK. Nunca representa acesso ativado e não valida por si só uma assinatura ativa. Havendo duas compras do mesmo usuário ou cliente Stripe, as DUAS pendências passam para REVIEW_DUPLICATE_PURCHASE. Eventos repetidos não geram linhas duplicadas. Após reinicialização os arquivos persistentes são reabertos e é possível reconstruir a pendência a partir do histórico de eventos confirmado.

O módulo pending-handoff.mjs contém simulações de email Clerk verificado, assinatura confirmada e ausência de cliente/assinatura conflitante. A prévia não possui chaves do Clerk oficial e não disponibiliza endpoint para aceitar alegações de email verificado enviadas pelo público. Mesmo com evidências virtuais válidas, accountActivated permanece false e a única ação possível é uma futura conciliação no backend autenticado, a ser autorizada separadamente. Nenhum dado de produção é lido ou alterado neste trabalho.

## Simulador de conciliação do financeiro oficial, sem acesso ao SaaS

O arquivo official-reconciliation-dryrun.mjs especifica, com funções somente-leitura simuladas, a futura validação de um pagamento feito ANTES de criar conta. Nenhuma credencial, biblioteca oficial, rota ou banco é acessado. Somente um backend confiável deverá fornecer os adapters reais, após autorização específica.

Regras cobertas: pré-cadastro pago sem duplicidade, identidade Clerk autenticada e e-mail verificado, correspondência do e-mail verificado no Clerk com o pré-cadastro e IDs Stripe da compra (sem comparar e-mail do pagador), Checkout Stripe de TESTE completo e pago vinculado ao registro, assinatura TESTE ativa do mesmo cliente, plano interno e price id exatos, preço mensal em reais, fatura do mesmo contrato paga, uma única assinatura ativa, ausência de titular ou inscrição anteriores conflitantes, proteção contra novas concessões em retries.

Todo retorno, inclusive READY_FOR_AUTHORIZED_REVIEW, define accountActivated=false, creditsGranted=0 e requiresOfficialAuthorization=true. NÃO existe executor nem endpoint público para esse simulador.

Antes de implementar no backend oficial: usar o e-mail verificado no Clerk como identificador do assinante, conferindo-o com o pré-cadastro persistido, validando Customer Stripe e sessão por ID, sem comparar o e-mail do pagador ou titular do cartão; consultas Stripe/Clerk no servidor; verificar preços reais autorizados; índice único de claim e transação atômica com lock, reconfirmação de subscrição e customer; vínculo autorizado ao usuário Clerk; atualização idempotente da metadata clerkUserId da subscription; chamada da rotina existente handleCanonicalSubscriptionChange para liberar plano/créditos SEM dupla atribuição; recuperação de falhas, cancelamentos e reembolsos. Tudo isso é projeto futuro dependente de aprovação expressa.

## Identidade do assinante: regra comercial validada

O usuário da plataforma é identificado exclusivamente pelo **e-mail de cadastro verificado no Clerk**. O cartão pode pertencer a terceiro autorizado; nome, CPF e e-mail do titular do cartão não precisam coincidir com os dados do usuário. A verificação Clerk autentica o e-mail da pessoa que acessa a plataforma; o servidor confere o e-mail Clerk com o pré-cadastro persistido e confere os IDs Stripe da sessão, Customer e assinatura. Um e-mail meramente digitado não ativa plano. A simulação continua sem qualquer acesso ao banco do IAttom e sem alteração do financeiro oficial.


## Separação de pagamento e acesso

O Stripe aprova ou recusa pagamentos: o checkout comercial não consulta o Clerk antes da cobrança. Cartão de terceiro é permitido. Divergência de e-mail depois de pagamento registrado deixa apenas a vinculação de acesso no status PENDING_EMAIL_REVIEW; o pagamento permanece intocado. O simulador indica paymentRecorded=true e paymentUnchanged=true para a divergência, sem estornar, cancelar ou negar compras. A correção futura precisa de verificação segura, sem liberar acesso à conta errada. O trabalho não altera nem utiliza o ambiente oficial.


## Identidades distintas de compra

A: pré-cadastro (conta que receberá o plano), B: e-mail do pagador no Stripe, C: e-mail verificado no Clerk. Stripe captura B independentemente de A; ao criar Checkout não definir customer nem customer_email. O webhook assinado traz o ID do Customer e o associa à sessão e ao pré-cadastro A sem conferir B. Apenas Clerk C = A poderá receber o plano após reconciliação autenticada. C divergente: pagamento continua registrado e acesso fica pendente. Não são efetuadas cobranças ou integrações reais nesta prévia.
