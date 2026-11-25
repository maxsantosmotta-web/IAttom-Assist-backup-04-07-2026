import { spawnSync } from "node:child_process";

// Legacy backend has existing unrelated TS errors. Keep the full compiler
// diagnostics, but fail the integration CI on any error within its own files.
const result = spawnSync("pnpm", ["exec", "tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
});
if (result.error) throw result.error;
const output = (result.stdout ?? "") + "\n" + (result.stderr ?? "");
const errors = output.split(/\r?\n/).filter(line => /error TS\d+:/i.test(line));
const integrationPath = /(?:^|[\\/])(?:src[\\/])?(?:routes[\\/](?:chatgpt|externalOperations|externalHelpOperations|externalVideoOperations)\.ts|middlewares[\\/](?:requireExternalAccess|requireChatGPTAuth)\.ts|lib[\\/]chatgpt[\\/][^\s:(]+\.ts)\(/i;
const ownErrors = errors.filter(line => integrationPath.test(line));
console.log(`TypeScript diagnostics: ${errors.length} total; ${ownErrors.length} ChatGPT integration errors.`);
if (ownErrors.length) {
  for (const line of ownErrors) console.error(line);
  process.exitCode = 1;
} else if (result.status !== 0 && errors.length === 0) {
  console.error(output.slice(-3500));
  process.exitCode = 1;
}
