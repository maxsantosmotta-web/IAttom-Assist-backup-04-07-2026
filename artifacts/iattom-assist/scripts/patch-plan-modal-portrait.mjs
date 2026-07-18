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

source = source.replaceAll(
  "grid grid-cols-1 sm:grid-cols-3 gap-4",
  "grid grid-cols-1 lg:grid-cols-3 gap-4",
);

source = source.replace(
  'className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"',
  'className="fixed inset-0 z-50 flex items-start lg:items-center justify-center overflow-hidden p-0 sm:p-4"',
);

source = source.replace(
  'className="relative w-full max-w-5xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"',
  'ref={panelRef} className="relative w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] bg-[#0d0d0d] border border-white/10 sm:rounded-2xl shadow-depth-lg overflow-y-auto overscroll-contain"',
);

source = source.replace(
  'className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-30 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/98 backdrop-blur-md"',
);
source = source.replace(
  'className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-30 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/98 backdrop-blur-md"',
);

source = source.replace(
  'className="flex items-center gap-3"',
  'className="flex w-full lg:w-auto flex-wrap items-center justify-between lg:justify-end gap-2"',
);

source = source.replace(
  'className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors border border-white/[0.07]"',
  'className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-primary hover:text-primary/80 hover:bg-white/[0.06] transition-colors border border-white/[0.10]"',
);

if (!source.includes("Mobile fixed back bar")) {
  source = source.replace(
    '            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/35 to-transparent" />',
    '            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/35 to-transparent" />\n            {/* Mobile fixed back bar */}\n            <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.08] bg-[#0d0d0d] px-4 py-3 lg:hidden">\n              <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-primary">\n                <ChevronLeft className="h-4 w-4" />\n                Voltar\n              </button>\n              <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400">\n                <X className="h-4 w-4" />\n              </button>\n            </div>',
  );
}

writeFileSync(modalUrl, source);
console.log("Plan modal opens at top with a fixed mobile back bar and one-column portrait layout.");
