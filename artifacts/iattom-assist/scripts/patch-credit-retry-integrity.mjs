import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve("src");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}

const files = walk(srcRoot);

function findSingleFile(marker, label) {
  const matches = files.filter((file) => fs.readFileSync(file, "utf8").includes(marker));
  if (matches.length !== 1) {
    throw new Error(`[credit-retry-integrity] ${label}: esperado 1 arquivo, encontrados ${matches.length}`);
  }
  return matches[0];
}

function replaceOnce(file, before, after, label) {
  const source = fs.readFileSync(file, "utf8");
  const count = source.split(before).length - 1;
  if (count === 0 && source.includes(after)) return;
  if (count !== 1) {
    throw new Error(`[credit-retry-integrity] ${label}: esperado 1 trecho, encontrados ${count}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
}

const findProductsFile = findSingleFile('generate("/api/ai/find-products"', "Buscar Produtos");
replaceOnce(
  findProductsFile,
  `                <Button size="sm" variant="outline" onClick={handleRetry} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">\n                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente\n                </Button>`,
  `                <CreditsGate feature="product_discovery" onSuccess={(charge) => { reset(); runSearch(charge); }} disabled={isGenerating}>\n                  {({ trigger, isLoading }) => (\n                    <Button size="sm" variant="outline" onClick={trigger} disabled={isLoading || isGenerating} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">\n                      <RefreshCw className={\`w-3.5 h-3.5 mr-1.5 \${isLoading ? "animate-spin" : ""}\`} /> Tentar novamente\n                    </Button>\n                  )}\n                </CreditsGate>`,
  "nova tentativa de Buscar Produtos",
);

const validateFile = findSingleFile('generate("/api/ai/validate-product"', "Validar Produto");
replaceOnce(
  validateFile,
  `                <Button size="sm" variant="outline" onClick={handleRetry} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">\n                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente\n                </Button>`,
  `                <CreditsGate feature="product_validation" onSuccess={(charge) => { reset(); runValidation(charge); }} disabled={isGenerating}>\n                  {({ trigger, isLoading }) => (\n                    <Button size="sm" variant="outline" onClick={trigger} disabled={isLoading || isGenerating} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0">\n                      <RefreshCw className={\`w-3.5 h-3.5 mr-1.5 \${isLoading ? "animate-spin" : ""}\`} /> Tentar novamente\n                    </Button>\n                  )}\n                </CreditsGate>`,
  "nova tentativa de Validar Produto",
);

const contentFile = findSingleFile('generate("/api/ai/create-content"', "Criar Conteúdo");
replaceOnce(
  contentFile,
  `<Button size="sm" variant="outline" onClick={() => { reset(); generate("/api/ai/create-content", { topic, tone: tone || undefined, additionalContext: additionalContext || undefined }); }} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente</Button>`,
  `<CreditsGate feature="content" onSuccess={(charge) => { reset(); runGenerate(charge); }} disabled={isGenerating}>\n                  {({ trigger, isLoading }) => (\n                    <Button size="sm" variant="outline" onClick={trigger} disabled={isLoading || isGenerating} className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"><RefreshCw className={\`w-3.5 h-3.5 mr-1.5 \${isLoading ? "animate-spin" : ""}\`} /> Tentar novamente</Button>\n                  )}\n                </CreditsGate>`,
  "nova tentativa de Criar Conteúdo",
);

const campaignFile = findSingleFile('body: JSON.stringify({ feature: "campaign" })', "reembolso da Campanha");
const campaignSource = fs.readFileSync(campaignFile, "utf8");
const refundBlock = `  const refundCalledRef = useRef(false);\n  useEffect(() => {\n    if (status === "error" && !refundCalledRef.current) {\n      refundCalledRef.current = true;\n      fetch("/api/credits/refund", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ feature: "campaign" }),\n        credentials: "include",\n      }).catch(() => {});\n    }\n    if (status === "idle" || status === "generating") refundCalledRef.current = false;\n  }, [status]);\n\n`;

if (campaignSource.includes(refundBlock)) {
  let next = campaignSource.replace(refundBlock, "");
  if (!next.includes("useRef(")) {
    next = next.replace("useState, useEffect, useRef", "useState, useEffect");
  }
  fs.writeFileSync(campaignFile, next);
} else if (campaignSource.includes('body: JSON.stringify({ feature: "campaign" })')) {
  throw new Error("[credit-retry-integrity] Campanha: bloco de reembolso mudou; ajuste abortado");
}

for (const [file, forbidden, label] of [
  [findProductsFile, "onClick={handleRetry}", "Buscar Produtos"],
  [validateFile, "onClick={handleRetry}", "Validar Produto"],
  [contentFile, 'onClick={() => { reset(); generate("/api/ai/create-content"', "Criar Conteúdo"],
  [campaignFile, 'body: JSON.stringify({ feature: "campaign" })', "Campanha"],
]) {
  if (fs.readFileSync(file, "utf8").includes(forbidden)) {
    throw new Error(`[credit-retry-integrity] ${label}: validação final falhou`);
  }
}

console.log("[credit-retry-integrity] retries protegidos e reembolso antecipado removido");
