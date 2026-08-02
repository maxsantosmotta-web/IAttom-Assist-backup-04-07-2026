import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const authImport = 'import { useAuth } from "@clerk/react";';
if (!source.includes(authImport)) {
  const reactImport = 'import { useEffect, useState } from "react";';
  if (!source.includes(reactImport)) throw new Error("Analytics React import marker not found");
  source = source.replace(reactImport, `${reactImport}\n${authImport}`);
}

const componentMarker = `export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);`;
const componentReplacement = `export function Analytics() {
  const { isLoaded, getToken } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);`;
if (!source.includes("const { isLoaded, getToken } = useAuth();")) {
  if (!source.includes(componentMarker)) throw new Error("Analytics component marker not found");
  source = source.replace(componentMarker, componentReplacement);
}

const oldEffect = `  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(\`/api/analytics/user?days=\${days}\`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(\`Analytics failed: \${response.status}\`);
        return response.json() as Promise<AnalyticsData>;
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days, refreshTick]);`;

const newEffect = `  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadAnalytics = async () => {
      setLoading(true);
      const retryDelays = [0, 500, 1200, 2500];

      try {
        for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
          if (retryDelays[attempt] > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
          }
          if (cancelled) return;

          const token = await getToken();
          if (!token) continue;

          const response = await fetch(\`/api/analytics/user?days=\${days}\`, {
            credentials: "include",
            headers: { Authorization: \`Bearer \${token}\` },
            signal: controller.signal,
          });

          if (response.ok) {
            const result = await response.json() as AnalyticsData;
            if (!cancelled) setData(result);
            return;
          }

          const transient = response.status === 401
            || response.status === 403
            || response.status === 429
            || response.status >= 500;
          if (!transient || attempt === retryDelays.length - 1) {
            throw new Error(\`Analytics failed: \${response.status}\`);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Preserve the last valid analytics result instead of replacing it with zeros.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAnalytics();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [days, refreshTick, isLoaded, getToken]);`;

if (!source.includes("const retryDelays = [0, 500, 1200, 2500];")) {
  if (!source.includes(oldEffect)) throw new Error("Analytics loading effect marker not found");
  source = source.replace(oldEffect, newEffect);
}

for (const marker of [
  authImport,
  "const { isLoaded, getToken } = useAuth();",
  "const retryDelays = [0, 500, 1200, 2500];",
  'headers: { Authorization: `Bearer ${token}` }',
  "controller.abort();",
]) {
  if (!source.includes(marker)) throw new Error(`Analytics authenticated loading marker missing: ${marker}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Activities now waits for Clerk and preserves valid analytics data across transient failures.");
