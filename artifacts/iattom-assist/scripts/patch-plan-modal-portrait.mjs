import { readFileSync, writeFileSync } from "node:fs";

const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let source = readFileSync(modalUrl, "utf8");

// Celular em pé: uma coluna. Modo computador, tablet largo e desktop: três colunas.
source = source.replaceAll(
  "grid grid-cols-1 sm:grid-cols-3 gap-4",
  "grid grid-cols-1 lg:grid-cols-3 gap-4",
);

// O próprio painel controla a rolagem; o overlay não cria uma segunda rolagem concorrente.
source = source.replace(
  'className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"',
  'className="fixed inset-0 z-50 flex items-start lg:items-center justify-center overflow-hidden p-2 sm:p-4"',
);

// Cabeçalho empilhado no celular e horizontal somente em telas maiores.
source = source.replace(
  'className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-20 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
);
source = source.replace(
  'className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-20 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
);

// Mantém o botão Voltar existente visível e evita que os controles saiam da largura do celular.
source = source.replace(
  'className="flex items-center gap-3"',
  'className="flex w-full lg:w-auto flex-wrap items-center justify-between lg:justify-end gap-2"',
);
source = source.replace(
  'className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors border border-white/[0.07]"',
  'className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-primary hover:text-primary/80 hover:bg-white/[0.06] transition-colors border border-white/[0.10]"',
);

writeFileSync(modalUrl, source);
console.log("Plan comparison modal uses one column in portrait and keeps Voltar visible.");
