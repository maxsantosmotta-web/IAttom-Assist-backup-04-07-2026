/**
 * Fail closed unless this process is wired to a distinctly named test database.
 * A toggle by itself is NOT proof of isolation. Does not create infrastructure
 * or access any database when evaluating the guard.
 */
export function isolatedExternalWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CHATGPT_OPERATIONS_ENABLED !== "true" ||
      env.CHATGPT_EXTERNAL_WRITES_ENABLED !== "true" ||
      env.CHATGPT_EXTERNAL_ISOLATED_DB !== "true") return false;
  if (!env.DATABASE_URL || !env.CHATGPT_SANDBOX_DATABASE_URL) return false;
  try {
    const active = new URL(env.DATABASE_URL);
    const sandbox = new URL(env.CHATGPT_SANDBOX_DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(active.protocol) || active.protocol !== sandbox.protocol) return false;
    if (active.toString() !== sandbox.toString()) return false;
    if (env.CHATGPT_PRODUCTION_DATABASE_URL &&
        new URL(env.CHATGPT_PRODUCTION_DATABASE_URL).toString() === active.toString()) return false;
    const databaseName = decodeURIComponent(active.pathname.slice(1));
    if (!/(?:^|[_-])(sandbox|test)(?:$|[_-])/i.test(databaseName)) return false;
    if (!active.hostname || !databaseName || active.username === "") return false;
    return true;
  } catch {
    return false;
  }
}
