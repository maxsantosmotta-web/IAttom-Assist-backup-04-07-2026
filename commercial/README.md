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
