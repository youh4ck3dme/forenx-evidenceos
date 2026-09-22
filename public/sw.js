const CACHE = "forenx-shell-v2";
const PRECACHE = [
  "/",
  "/favicon.svg",
  "/icons/icon.svg",
  "/manifest.webmanifest",
  "/__grok/manifest.webmanifest",
  "/__grok/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2")
  );
}

function isIconOrManifest(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname.endsWith(".webmanifest")
  );
}

/**
 * @param {Request} request
 * @param {Response} response
 */
async function putAsset(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

function isAiOrApi(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.includes("/ai/") ||
    url.pathname.startsWith("/__tanstack")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isAiOrApi(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        void putAsset(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  if (isIconOrManifest(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          void putAsset(request, fresh.clone());
          return fresh;
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      })(),
    );
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("/");
    if (fallback) return fallback;
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
