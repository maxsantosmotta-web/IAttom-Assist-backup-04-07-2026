import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const defaultApiServerUrl = "http://workspaceapi-server.railway.internal:8080";
const apiServerUrl = (process.env.API_SERVER_URL?.trim() || defaultApiServerUrl).replace(/\/+$/, "");
const apiProxy: Record<string, string | ProxyOptions> = {
  "/api": {
    target: apiServerUrl,
    changeOrigin: true,
    secure: apiServerUrl.startsWith("https://"),
  },
};

const isReplitDevelopment =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined;

const replitDevelopmentPlugins = isReplitDevelopment
  ? await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then((m) =>
        m.default(),
      ),
      import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
      ),
      import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
    ])
  : [];

const iattomRuntimeSafety: Plugin = {
  name: "iattom-runtime-safety",
  enforce: "pre",
  transform(code, id) {
    const normalizedId = id.replaceAll("\\", "/");

    if (normalizedId.endsWith("/src/pages/admin/AdminOverview.tsx")) {
      const patched = code.replaceAll(
        "analytics.planRevenue.find(",
        "(analytics.planRevenue ?? []).find(",
      );

      if (patched === code && !code.includes("(analytics.planRevenue ?? []).find(")) {
        throw new Error("AdminOverview runtime safety transform was not applied");
      }

      return { code: patched, map: null };
    }

    return null;
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    iattomRuntimeSafety,
    react(),
    tailwindcss({ optimize: false }),
    ...replitDevelopmentPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: apiProxy,
  },
});
