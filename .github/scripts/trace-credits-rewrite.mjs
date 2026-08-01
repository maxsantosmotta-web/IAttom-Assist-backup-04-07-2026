import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const root = process.cwd();
const frontendDir = path.join(root, "artifacts/iattom-assist");
const requireFromFrontend = createRequire(path.join(frontendDir, "package.json"));
const { transformSync } = requireFromFrontend("esbuild");
const packageJson = JSON.parse(fs.readFileSync(path.join(frontendDir, "package.json"), "utf8"));
const commands = String(packageJson.scripts.build)
  .split("&&")
  .map((command) => command.trim())
  .filter((command) => command.startsWith("node scripts/"));
const creditsPath = path.join(frontendDir, "src/pages/dashboard/Credits.tsx");

function assertCreditsSyntax(command) {
  const source = fs.readFileSync(creditsPath, "utf8");
  try {
    transformSync(source, {
      loader: "tsx",
      jsx: "automatic",
      sourcemap: false,
      sourcefile: "Credits.tsx",
    });
  } catch (error) {
    const lines = source.split("\n");
    console.error(`BROKEN_CREDITS_INTRODUCED_BY=${command}`);
    console.error(lines.slice(374, 390).join("\n"));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

assertCreditsSyntax("initial source");
for (const command of commands) {
  execSync(command, { cwd: frontendDir, stdio: "inherit" });
  assertCreditsSyntax(command);
}

console.log("Todos os patches diretos preservaram a sintaxe de Credits.tsx.");
