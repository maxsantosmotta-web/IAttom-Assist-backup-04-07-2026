const CACHE_VERSION = "iattom-assist-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".ttf"];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isHtmlRequest(request) {
  return request.headers.get("Accept")?.includes("text/html");
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "IATTOM_UPDATE_READY", version: CACHE_VERSION });
        }
      }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/sw.js") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isHtmlRequest(event.request) || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              void cache.put(event.request, response.clone());
            }
            return response;
          });
        }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request)),
  );
});
