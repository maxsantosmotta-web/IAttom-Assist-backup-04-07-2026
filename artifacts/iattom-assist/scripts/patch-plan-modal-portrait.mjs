import { readFileSync, writeFileSync } from "node:fs";

const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let source = readFileSync(modalUrl, "utf8");

source = source.replace(
  'import { useState } from "react";',
  'import { useEffect, useRef, useState } from "react";',
);

source = source.replace(
  '  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");',
  '  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");\n  const panelRef = useRef<HTMLDivElement | null>(null);\n\n  useEffect(() => {\n    if (!open) return;\n    requestAnimationFrame(() => panelRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" }));\n  }, [open]);',
);

// Telefone normal: planos empilhados. Modo computador, paisagem larga e desktop: lado a lado.
source = source.replaceAll(
  "grid grid-cols-1 sm:grid-cols-3 gap-4",
  "grid grid-cols-1 min-[700px]:grid-cols-3 gap-4",
);
source = source.replaceAll(
  "grid grid-cols-1 lg:grid-cols-3 gap-4",
  "grid grid-cols-1 min-[700px]:grid-cols-3 gap-4",
);

source = source.replace(
  'className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"',
  'className="fixed inset-0 z-50 flex items-start min-[700px]:items-center justify-center overflow-hidden p-0 min-[700px]:p-4"',
);
source = source.replace(
  'className="fixed inset-0 z-50 flex items-center justify-center p-4"',
  'className="fixed inset-0 z-50 flex items-start min-[700px]:items-center justify-center overflow-hidden p-0 min-[700px]:p-4"',
);

source = source.replace(
  'className="relative w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"',
  'ref={panelRef} className="relative w-full max-w-5xl h-[100dvh] min-[700px]:h-auto min-[700px]:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 min-[700px]:rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"',
);
source = source.replace(
  'className="relative w-full max-w-5xl bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-hidden"',
  'ref={panelRef} className="relative w-full max-w-5xl h-[100dvh] min-[700px]:h-auto min-[700px]:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 min-[700px]:rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"',
);

source = source.replace(
  'className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-30 flex flex-col min-[700px]:flex-row min-[700px]:items-start min-[700px]:justify-between gap-3 p-4 min-[700px]:p-6 min-[700px]:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/98 backdrop-blur-md"',
);
source = source.replace(
  'className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.06]"',
  'className="sticky top-0 z-30 flex flex-col min-[700px]:flex-row min-[700px]:items-start min-[700px]:justify-between gap-3 p-4 min-[700px]:p-6 min-[700px]:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/98 backdrop-blur-md"',
);
source = source.replace(
  'className="flex items-center gap-3"',
  'className="flex w-full min-[700px]:w-auto flex-wrap items-center justify-between min-[700px]:justify-end gap-2"',
);

// Mantém somente o botão Voltar. O X não é utilizado neste fluxo.
source = source.replace(
  `                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>`,
  "",
);

// Remove uma barra móvel duplicada caso algum build anterior a tenha inserido.
const mobileBarStart = '            {/* Mobile fixed back bar */}';
if (source.includes(mobileBarStart)) {
  const nextHeader = source.indexOf('            <div className="sticky top-0', source.indexOf(mobileBarStart));
  if (nextHeader > -1) {
    source = source.slice(0, source.indexOf(mobileBarStart)) + source.slice(nextHeader);
  }
}

writeFileSync(modalUrl, source);
console.log("Plan modal keeps one mobile back button, stacked portrait cards and desktop side-by-side layout.");
