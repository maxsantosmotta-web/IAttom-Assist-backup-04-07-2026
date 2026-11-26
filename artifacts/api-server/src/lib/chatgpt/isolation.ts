// External production writes are disabled unless explicitly released.
export function productionExternalWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CHATGPT_OPERATIONS_ENABLED === "true" &&
    env.CHATGPT_EXTERNAL_WRITES_ENABLED === "true" &&
    env.CHATGPT_PRODUCTION_RELEASED === "true" &&
    env.RAILWAY_PROJECT_ID === "0ded634b-c643-4655-b252-60c438c10b62" &&
    env.RAILWAY_ENVIRONMENT_ID === "08959294-7371-49d2-82b0-471f45166edb" &&
    env.RAILWAY_SERVICE_ID === "16a13f32-b8e5-4e0a-b2ed-526164375e82" &&
    Boolean(env.DATABASE_URL);
}
