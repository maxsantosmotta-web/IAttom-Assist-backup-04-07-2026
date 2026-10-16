# TRILHO OFICIAL — NOVA PÁGINA COMERCIAL IAttom Assist

Status: planejamento aprovado; etapa 1 é a próxima. Não confundir mockup de imagem com implementação funcional.

## Ordem obrigatória
1. Página visual: construir cabeçalho, apresentação, formulário demonstrativo, módulos, demonstrações, vídeo institucional reservado, planos, FAQ, CTAs e rodapé. Mostrar previews/prints e refinar com aprovação do usuário.
2. Clerk: integrar cadastro e login reais, incluindo senha e verificação de e-mail conforme configuração existente. Não criar autenticação paralela.
3. Stripe: integrar escolha do plano, checkout e ativação somente após confirmação do pagamento, vinculando assinatura à conta autenticada; preservar fluxos de clientes existentes.
4. Testes ponta a ponta: novo visitante → página → escolha do plano → cadastro/verificação → pagamento → plano e créditos no dashboard; testar pagamento aprovado, cancelado e abandono.
5. Publicação: apenas após testes e autorização, em domínio comercial separado (preferência: oferta.iattomassist.com.br).

## Identidade e referências
- Marca: IAttom Assist. Preto, dourado e branco, visual premium responsivo.
- Último mockup com formulário integrado é referência de composição, não fonte de preços ou números.
- Usar apenas preços, créditos e funcionalidades reais verificados no sistema; não inventar métricas, provas sociais ou depoimentos.
- Formulário deve ser curto e visualmente integrado à página; Clerk continua responsável pela segurança.
- Vídeo institucional inicialmente como espaço reservado.
- Os CTAs devem encaminhar para escolha do plano e cadastro sem perder o plano selecionado.

## Proteções
- Trabalhar nesta branch separada; não modificar produção, domínio atual, login ou Stripe de clientes existentes sem autorização.
- Não avançar para etapa seguinte antes de apresentar a anterior para validação.
- Sem deploy ou merge na branch principal sem autorização expressa.
- Ao mudar a ordem ou arquitetura, explicar a diferença e pedir aprovação antes de alterar.
