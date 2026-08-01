import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const PLATFORM_ROUTES = [
  "/dashboard/mercado-livre",
  "/dashboard/shopee",
  "/dashboard/tiktok",
  "/dashboard/hotmart",
  "/dashboard/kiwify",
  "/dashboard/facebook",
  "/dashboard/instagram",
];

const PERSISTENT_ENDPOINTS = [
  "/api/__clerk",
  "/api/auth/",
  "/api/users/sync",
];

function isIsolatedRoute(path: string): boolean {
  if (!path.startsWith("/dashboard")) return false;
  return !PLATFORM_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

function requestIdentity(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") return null;

  const rawUrl = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (PERSISTENT_ENDPOINTS.some((endpoint) => url.pathname.startsWith(endpoint))) return null;
    return `${method}:${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function mergeSignals(moduleSignal: AbortSignal, callerSignal?: AbortSignal | null): AbortSignal {
  if (!callerSignal) return moduleSignal;
  if (callerSignal.aborted) return callerSignal;

  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };

  moduleSignal.addEventListener("abort", () => abort(moduleSignal), { once: true });
  callerSignal.addEventListener("abort", () => abort(callerSignal), { once: true });
  return controller.signal;
}

export function RouteRequestIsolation() {
  const [location] = useLocation();
  const routeRef = useRef(location);
  const moduleKeyRef = useRef(location);
  const controllerRef = useRef(new AbortController());
  const pendingRef = useRef(new Map<string, Promise<Response>>());
  routeRef.current = location;

  useEffect(() => {
    const activateModule = (nextKey: string) => {
      if (moduleKeyRef.current === nextKey) return;
      controllerRef.current.abort("module-changed");
      controllerRef.current = new AbortController();
      pendingRef.current.clear();
      moduleKeyRef.current = nextKey;
    };

    activateModule(location);

    const handleModuleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleKey?: string }>).detail;
      if (!detail?.moduleKey) return;
      activateModule(detail.moduleKey);
    };

    window.addEventListener("iattom-module-change", handleModuleChange);
    return () => window.removeEventListener("iattom-module-change", handleModuleChange);
  }, [location]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const isolatedFetch: typeof window.fetch = async (input, init) => {
      const activeRoute = routeRef.current;
      const identity = requestIdentity(input, init);

      if (!identity || !isIsolatedRoute(activeRoute)) {
        return originalFetch(input, init);
      }

      const existing = pendingRef.current.get(identity);
      if (existing) return existing.then((response) => response.clone());

      const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const request = originalFetch(input, {
        ...init,
        signal: mergeSignals(controllerRef.current.signal, callerSignal),
      });

      pendingRef.current.set(identity, request);

      try {
        const response = await request;
        return response;
      } finally {
        if (pendingRef.current.get(identity) === request) pendingRef.current.delete(identity);
      }
    };

    window.fetch = isolatedFetch;

    return () => {
      controllerRef.current.abort("isolation-unmounted");
      pendingRef.current.clear();
      if (window.fetch === isolatedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
