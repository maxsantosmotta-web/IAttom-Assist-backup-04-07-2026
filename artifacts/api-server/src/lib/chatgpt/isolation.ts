/**
 * Fail closed unless all external-write flags are enabled and the running
 * process is the existing IAttom stripe-upgrade-test Railway environment.
 * Railway private networking resolves postgres.railway.internal separately
 * for each environment, so the PostgreSQL database name "railway" is normal.
 *
 * This guard does not connect to databases, create resources or deploy.
 * Never accept a caller-supplied environment identity.
 */
const TEST_PROJECT = "0ded634b-c643-4655-b252-60c438c10b62";
const TEST_ENVIRONMENT = "32965107-60c2-4259-966b-38f8fed7a00b";

export function isolatedExternalWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CHATGPT_OPERATIONS_ENABLED !== "true" ||
      env.CHATGPT_EXTERNAL_WRITES_ENABLED !== "true" ||
      env.CHATGPT_EXTERNAL_ISOLATED_DB !== "true") return false;

  if (env.RAILWAY_PROJECT_ID !== TEST_PROJECT ||
      env.RAILWAY_ENVIRONMENT_ID !== TEST_ENVIRONMENT) return false;

  if (!env.DATABASE_URL || !env.CHATGPT_SANDBOX_DATABASE_URL) return false;
  try {
    const active = new URL(env.DATABASE_URL);
    const sandbox = new URL(env.CHATGPT_SANDBOX_DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(active.protocol) ||
        active.protocol !== sandbox.protocol) return false;
    if (active.toString() !== sandbox.toString()) return false;
    if (env.CHATGPT_PRODUCTION_DATABASE_URL &&
        new URL(env.CHATGPT_PRODUCTION_DATABASE_URL).toString() === active.toString()) return false;

    if (!active.hostname || active.username === "" || !active.pathname.slice(1)) return false;
    // Restrict execution to the Postgres reachable on the environment-local
    // private Railway network, not an arbitrary public or external database.
    if (active.hostname !== "postgres.railway.internal" || active.port !== "5432" ||
        decodeURIComponent(active.pathname.slice(1)) !== "railway") return false;
    return true;
  } catch {
    return false;
  }
}
