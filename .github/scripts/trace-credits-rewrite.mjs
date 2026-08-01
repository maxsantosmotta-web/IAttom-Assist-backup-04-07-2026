import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const frontendDir = path.join(root, "artifacts/iattom-assist");
const packageJson = JSON.parse(fs.readFileSync(path.join(frontendDir, "package.json"), "utf8"));
const commands = String(packageJson.scripts.build)
  .split("&&")
  .map((command) => command.trim())
  .filter((command) => command.startsWith("node scripts/"));
const creditsPath = path.join(frontendDir, "src/pages/dashboard/Credits.tsx");

function hasBrokenRewrite(source) {
  return source.includes("tx as typeof tx & { balanceType?: string | null }");
}

for (const command of commands) {
  execSync(command, { cwd: frontendDir, stdio: "inherit" });
  const source = fs.readFileSync(creditsPath, "utf8");
  if (hasBrokenRewrite(source)) {
    const lines = source.split("\n");
    console.error(`BROKEN_CREDITS_INTRODUCED_BY=${command}`);
    console.error(lines.slice(374, 390).join("\n"));
    process.exit(1);
  }
}

console.log("Nenhum patch direto do build introduziu os casts obsoletos.");
