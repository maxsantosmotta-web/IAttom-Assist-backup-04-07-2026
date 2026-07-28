import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/routes/help.ts", import.meta.url);
let source = readFileSync(helpUrl, "utf8");

const marker = `BENEFÍCIOS QUE PODEM SER CITADOS (somente quando compatíveis com funcionalidades reais existentes):`;
const block = `COMO FUNCIONA O CONSUMO — INFORMAÇÃO OFICIAL:
— Buscar Produtos: consome 5 créditos por utilização concluída.
— Validar Produto: consome 5 créditos por utilização concluída.
— Criar Prompt: consome 5 créditos por utilização concluída.
— Criar Campanha: consome 10 créditos por utilização concluída.
— Criar Conteúdo: consome 10 créditos por utilização concluída.
— Scripts de Vídeo: consome 10 créditos por utilização concluída.
— IAttom Help: não desconta créditos gerais. O uso é contado por mensagem respondida com sucesso, dentro do limite mensal do plano. Não existe cobrança por frase, bloco ou trecho da resposta.
— Gerar Imagem: consome 1 unidade de imagem por imagem gerada. Internamente, cada unidade corresponde a 10 créditos criativos, mas para o usuário o saldo é apresentado em imagens.
— Gerar Vídeo com Efeito: consome 1 unidade de vídeo por vídeo gerado, conforme o saldo do pacote de vídeos.
— Créditos gerais, imagens e vídeos são saldos separados. O uso de imagem não reduz créditos gerais, e o uso de vídeo não reduz créditos gerais nem imagens.
— Quando o saldo necessário acabar, o usuário precisa adquirir o pacote correspondente ou aguardar a renovação do benefício aplicável ao plano.

REGRAS DE EXPLICAÇÃO DO CONSUMO:
— Explique sempre em linguagem simples e usando a unidade que o usuário vê na tela.
— Para imagens, diga “1 imagem”, não “10 créditos criativos”, salvo quando o usuário pedir a explicação técnica interna.
— Para vídeos, diga “1 vídeo” ou “1 unidade de vídeo”.
— Para o IAttom Help, diga “1 mensagem respondida”, nunca “por frase” ou “por bloco”.
— Não invente valores, descontos, limites ou pacotes diferentes dos definidos oficialmente.

`;

if (!source.includes(block.trim())) {
  if (!source.includes(marker)) throw new Error("Help knowledge marker not found");
  source = source.replace(marker, block + marker);
}

for (const required of [
  "Buscar Produtos: consome 5 créditos",
  "IAttom Help: não desconta créditos gerais",
  "Gerar Imagem: consome 1 unidade de imagem",
  "Gerar Vídeo com Efeito: consome 1 unidade de vídeo",
]) {
  if (!source.includes(required)) throw new Error(`Consumption guide marker missing: ${required}`);
}

writeFileSync(helpUrl, source);
console.log("IAttom Help consumption knowledge applied.");
