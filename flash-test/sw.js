// Service worker v9: cache only stable candle assets; keep HTML, API, logos, and chunks fresh.
const SW_VERSION = "candleme-sw-v9";
const CRITICAL_CACHE = `${SW_VERSION}-critical`;
const CRITICAL_ASSETS = [
  "/candleme-business-website/flash-test/assets/candle-mob.webp",
  "/candleme-business-website/flash-test/assets/wick.webp",
  "/candleme-business-website/flash-test/assets/candleme-flame-symbol.webp",
  "/candleme-business-website/flash-test/assets/fonts/Cinzel-Regular.woff2",
];
const CRITICAL_PATHS = new Set(CRITICAL_ASSETS);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CRITICAL_CACHE);
        await Promise.all(
          CRITICAL_ASSETS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: "reload" });
              if (response.ok) await cache.put(url, response);
            } catch {
              // Allow installation when flaky connections miss a cache entry.
            }
          }),
        );
      } catch {
        // Fall back to native HTTP caching when Cache Storage is unavailable.
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key !== CRITICAL_CACHE)
            .map((key) => caches.delete(key)),
        );
      } catch {
        // Cache API unavailable — nothing to clean.
      }
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch {
        // Older Safari falls back to a plain navigation fetch.
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Return preloaded or network navigation responses without caching them.
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
        } catch {
          // Preload failed/aborted — fall through to a normal fetch.
        }
        return fetch(event.request);
      })(),
    );
    return;
  }
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method === "GET" &&
    requestUrl.origin === self.location.origin &&
    CRITICAL_PATHS.has(requestUrl.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CRITICAL_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })(),
    );
    return;
  }
  // Let the browser handle every other request without worker overhead.
});

// Keep the version in the byte diff so browsers detect worker updates.
self.__CANDLEME_SW_VERSION = SW_VERSION;
