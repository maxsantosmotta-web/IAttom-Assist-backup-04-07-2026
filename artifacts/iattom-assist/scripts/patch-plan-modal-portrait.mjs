import { readFileSync, writeFileSync } from "node:fs";

const modalUrl = new URL("../src/components/PlanComparisonModal.tsx", import.meta.url);
let source = readFileSync(modalUrl, "utf8");

source = source.replace(
  'className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain p-2 sm:p-4"',
  'className="fixed inset-0 z-50 flex items-start lg:items-center justify-center overflow-hidden p-2 sm:p-4"',
);

source = source.replace(
  'className="sticky top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
  'className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md"',
);

source = source.replaceAll(
  'grid grid-cols-1 sm:grid-cols-3 gap-4',
  'grid grid-cols-1 lg:grid-cols-3 gap-4',
);

if (!source.includes("Mobile plan modal back button")) {
  const headerStart = `            <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md">\n              <div>`;
  const headerWithBack = `            <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-md">\n              {/* Mobile plan modal back button */}\n              <button\n                type="button"\n                onClick={onClose}\n                className="sm:hidden inline-flex items-center gap-2 self-start rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-primary active:bg-white/5"\n              >\n                <span aria-hidden="true">←</span>\n                Voltar\n              </button>\n              <div>`;

  if (!source.includes(headerStart)) {
    throw new Error("Plan modal responsive header marker was not found");
  }
  source = source.replace(headerStart, headerWithBack);
}

writeFileSync(modalUrl, source);
console.log("Plan comparison modal is portrait-friendly and has a visible mobile back button.");