/**
 * Central domain resolver for IAttom Assist.
 *
 * Resolution priority:
 *   1. APP_CUSTOM_DOMAIN  — set this to "iattomassist.com.br" when the DNS
 *                           has been pointed and the deployment is live.
 *   2. REPLIT_DOMAINS[0]  — Replit-managed domain (replit.app).
 *   3. http://localhost:80 — local development fallback.
 *
 * Never import REPLIT_DOMAINS directly in business logic — always use these
 * helpers so a single env var controls the canonical domain everywhere.
 */

/**
 * Returns the full origin (scheme + host, no trailing slash) to use as the
 * canonical public URL for this deployment.
 *
 * Examples:
 *   APP_CUSTOM_DOMAIN=iattomassist.com.br → "https://iattomassist.com.br"
 *   REPLIT_DOMAINS=abc.replit.app         → "https://abc.replit.app"
 *   (neither set)                         → "http://localhost:80"
 */
export function getPrimaryOrigin(): string {
  if (process.env.APP_CUSTOM_DOMAIN) {
    return `https://${process.env.APP_CUSTOM_DOMAIN}`;
  }
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;
  return "http://localhost:80";
}

/**
 * Returns only the hostname (no scheme) of the canonical domain, or
 * undefined when running locally with no env vars set.
 *
 * Useful when a plain host string is needed (e.g. webhook URL building).
 */
export function getPrimaryHost(): string | undefined {
  if (process.env.APP_CUSTOM_DOMAIN) return process.env.APP_CUSTOM_DOMAIN;
  return process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
}
