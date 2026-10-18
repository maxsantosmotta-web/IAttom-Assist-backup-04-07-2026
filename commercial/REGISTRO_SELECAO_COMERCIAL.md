# Registro persistente de seleção de plano na landing isolada

O POST /api/stripe/official-checkout agora consulta a API oficial em GET, verifica plano/priceId/valor/créditos e GRAVA no volume exclusivo do PREVIEW uma intenção de checkout com UUID, segredo aleatório de 256 bits guardado somente como SHA-256, validade de 24h. Responde com a confirmação de escolha. Não produz sessão Stripe, cobrança, assinatura, Customer ou concessão de créditos.

POST /api/checkout/selection-status confere segredo e restaura a seleção mesmo após reinício, sem revelar e-mail, sem permitir acesso Clerk e sem consultar o banco oficial.

A landing salva id e token em sessionStorage local ao navegador, mostra que é apenas escolha e permite retomar a informação após atualização da página. Este token comprova apenas acesso à seleção no PREVIEW, não a identidade do cliente.

Todos os pagamentos seguem BLOQUEADOS por constantes do servidor. Não alterar Stripe, Clerk, créditos, banco, o repositório main ou deploy oficial. Futuramente, conectar um pagamento real só após a conciliação autenticada e aprovada no backend oficial.