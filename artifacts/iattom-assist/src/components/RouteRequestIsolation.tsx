import { useLayoutEffect, useRef } from "react";
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

function isInternalModuleRoute(path: string): boolean {
  if (!path.startsWith("/dashboard")) return false;
  return !PLATFORM_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

function shouldIsolateRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") return false;

  const rawUrl = input instanceof Request ? input.url : String(input);
  let url: URL;
  try {
    url = new URL(rawUrl, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  return !PERSISTENT_ENDPOINTS.some((endpoint) => url.pathname.startsWith(endpoint));
}

function combineSignals(routeController: AbortController, callerSignal?: AbortSignal | null): AbortSignal {
  if (!callerSignal) return routeController.signal;
  if (callerSignal.aborted) {
    routeController.abort(callerSignal.reason);
    return routeController.signal;
  }

  callerSignal.addEventListener(
    "abort",
    () => routeController.abort(callerSignal.reason),
    { once: true },
  );
  return routeController.signal;
}

export function RouteRequestIsolation() {
  const [location] = useLocation();
  const activeRouteRef = useRef(location);
  const previousRouteRef = useRef(location);
  const controllersRef = useRef(new Map<string, Set<AbortController>>());
  activeRouteRef.current = location;

  useLayoutEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = location;

    if (previousRoute === location || !isInternalModuleRoute(previousRoute)) return;

    const controllers = controllersRef.current.get(previousRoute);
    if (!controllers) return;

    controllers.forEach((controller) => controller.abort("route-changed"));
    controllersRef.current.delete(previousRoute);
  }, [location]);

  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const isolatedFetch: typeof window.fetch = async (input, init) => {
      const routeAtStart = activeRouteRef.current;
      if (!isInternalModuleRoute(routeAtStart) || !shouldIsolateRequest(input, init)) {
        return originalFetch(input, init);
      }

      const controller = new AbortController();
      const routeControllers = controllersRef.current.get(routeAtStart) ?? new Set<AbortController>();
      routeControllers.add(controller);
      controllersRef.current.set(routeAtStart, routeControllers);

      try {
        const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        return await originalFetch(input, {
          ...init,
          signal: combineSignals(controller, callerSignal),
        });
      } finally {
        routeControllers.delete(controller);
        if (routeControllers.size === 0) controllersRef.current.delete(routeAtStart);
      }
    };

    window.fetch = isolatedFetch;

    return () => {
      controllersRef.current.forEach((controllers) => {
        controllers.forEach((controller) => controller.abort("isolation-unmounted"));
      });
      controllersRef.current.clear();
      if (window.fetch === isolatedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
