import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const root = process.cwd();
const frontendDir = path.join(root, "artifacts/iattom-assist");
const apiDir = path.join(root, "artifacts/api-server");
const requireFromRoot = createRequire(path.join(root, "package.json"));
const ts = requireFromRoot("typescript");
const packageJson = JSON.parse(fs.readFileSync(path.join(apiDir, "package.json"), "utf8"));
const commands = String(packageJson.scripts.build)
  .split("&&")
  .map((command) => command.trim())
  .filter((command) => command.startsWith("node "));
const creditsPath = path.join(frontendDir, "src/pages/dashboard/Credits.tsx");

function assertCreditsSyntax(command) {
  const source = fs.readFileSync(creditsPath, "utf8");
  const result = ts.transpileModule(source, {
    fileName: "Credits.tsx",
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length === 0) return;

  const lines = source.split("\n");
  console.error(`BROKEN_CREDITS_INTRODUCED_BY=${command}`);
  console.error(lines.slice(374, 390).join("\n"));
  for (const diagnostic of errors) {
    console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  }
  process.exit(1);
}

assertCreditsSyntax("initial source before API build");
for (const command of commands) {
  execSync(command, { cwd: apiDir, stdio: "inherit" });
  assertCreditsSyntax(command);
}

console.log("Todos os comandos do build da API preservaram a sintaxe de Credits.tsx.");
