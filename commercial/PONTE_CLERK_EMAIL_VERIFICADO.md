# Ponte e-mail principal Clerk (apenas leitura)

Na branch de landing isolada: o servidor verifica um JWT Clerk via JWKS, confirma o segredo da seleção salva e compara o pré-cadastro com o e-mail PRIMÁRIO VERIFICADO da conta Clerk, recuperado apenas pelo Backend API GET /v1/users/{userId}.

O recurso é desativado por padrão: CLERK_BRIDGE_READ_ENABLED precisa ser explicitamente true e CLERK_BRIDGE_READ_SECRET_KEY precisa ser uma credencial separadamente autorizada. Não copiar o segredo administrativo de produção nem configurar estas variáveis sem permissão.

Nunca confia em email do navegador, só usa userId do JWT verificado e pré-cadastro do armazenamento do preview. Retorna apenas correspondência true/false e nunca devolve e-mail ou credencial.

Esta verificação NÃO confirma pagamento Stripe, não prova titularidade do cartão, não libera créditos, não vincula Customer nem cria conta. Sem alterar banco, Clerk, Stripe ou IAttom oficial. Sem credencial autorizada, endpoint retorna 503 e não faz consulta privada.