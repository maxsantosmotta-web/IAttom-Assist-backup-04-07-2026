import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const frontendDir = path.join(root, "artifacts/iattom-assist");
const apiDir = path.join(root, "artifacts/api-server");
const packageJson = JSON.parse(fs.readFileSync(path.join(apiDir, "package.json"), "utf8"));
const commands = String(packageJson.scripts.build)
  .split("&&")
  .map((command) => command.trim())
  .filter((command) => command.startsWith("node "));
const creditsPath = path.join(frontendDir, "src/pages/dashboard/Credits.tsx");

function assertCreditsSyntax(command) {
  try {
    execSync(
      'pnpm exec esbuild src/pages/dashboard/Credits.tsx --loader:.tsx=tsx --outfile=/tmp/credits-trace.js --log-level=error',
      { cwd: frontendDir, stdio: "pipe" },
    );
  } catch (error) {
    const source = fs.readFileSync(creditsPath, "utf8");
    const lines = source.split("\n");
    console.error(`BROKEN_CREDITS_INTRODUCED_BY=${command}`);
    console.error(lines.slice(374, 390).join("\n"));
    if (error && typeof error === "object" && "stderr" in error) {
      console.error(String(error.stderr));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

assertCreditsSyntax("initial source before API build");
for (const command of commands) {
  execSync(command, { cwd: apiDir, stdio: "inherit" });
  assertCreditsSyntax(command);
}

console.log("Todos os comandos do build da API preservaram a sintaxe de Credits.tsx.");
