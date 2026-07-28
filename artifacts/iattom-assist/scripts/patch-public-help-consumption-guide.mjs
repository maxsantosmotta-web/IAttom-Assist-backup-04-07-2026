import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/pages/HelpPage.tsx", import.meta.url);
let source = readFileSync(helpUrl, "utf8");

source = source
  .replace(
    "Cada funcionalidade de IA consome uma quantidade específica de créditos. Usuários do plano gratuito recebem créditos mensais renováveis. Planos pagos oferecem créditos ampliados e recursos adicionais.",
    "A plataforma usa três saldos separados: créditos gerais, imagens e vídeos com efeito. Cada recurso desconta apenas do saldo correspondente.",
  )
  .replace(
    "Cada recurso da plataforma consome uma quantidade de créditos: descoberta de produtos (5 cr), validação (5 cr), campanha (10 cr), conteúdo (8 cr), criativo (15 cr) e script de vídeo (10 cr). Os créditos renovam automaticamente todo mês.",
    "Buscar Produtos consome 5 créditos; Validar Produto, 5; Criar Prompt, 5; Criar Campanha, 10; Criar Conteúdo, 10; e Scripts de Vídeo, 10. O IAttom Help conta 1 mensagem respondida com sucesso e não desconta créditos gerais.",
  )
  .replace(
    "Quando os créditos se esgotam, as funcionalidades ficam pausadas até a renovação mensal. Você pode fazer upgrade a qualquer momento para obter mais créditos imediatamente.",
    "Quando um saldo acaba, apenas os recursos ligados a ele ficam indisponíveis. Créditos gerais, imagens e vídeos com efeito podem ser adquiridos separadamente conforme a opção disponível em Faturamento.",
  )
  .replaceAll("Criar Imagem e Vídeo", "Criar Imagem e Vídeo")
  .replace(
    "Acesse Faturamento no menu lateral e escolha um pacote de vídeos (5, 7 ou 10 vídeos). O saldo é permanente — não expira e não está vinculado ao ciclo mensal de créditos.",
    "Acesse Faturamento no menu lateral e escolha um Pacote de Vídeo com Efeito. Cada geração consome 1 unidade de vídeo; o saldo é separado dos créditos gerais e das imagens.",
  )
  .replace(
    "Sim. O módulo <strong className=\"text-zinc-300\">Criar Imagem e Vídeo</strong> possui duas abas: uma para geração de imagens (consome créditos do plano) e outra para geração de vídeos com IA (consome saldo de vídeos adquirido separadamente).",
    "Sim. O módulo <strong className=\"text-zinc-300\">Criar Imagem e Vídeo</strong> possui uma área para imagens e outra para vídeos com efeito. Cada imagem gerada consome 1 unidade de imagem e cada vídeo com efeito consome 1 unidade de vídeo.",
  );

for (const marker of [
  "Buscar Produtos consome 5 créditos",
  "IAttom Help conta 1 mensagem respondida com sucesso",
  "Cada imagem gerada consome 1 unidade de imagem",
  "cada vídeo com efeito consome 1 unidade de vídeo",
]) {
  if (!source.includes(marker)) throw new Error(`Public help consumption marker missing: ${marker}`);
}

writeFileSync(helpUrl, source);
console.log("Public Help page consumption guide updated.");
