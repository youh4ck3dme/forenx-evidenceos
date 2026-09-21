/* ForenX EvidenceOS — offline app-shell service worker.
 * CACHE = forenx-shell-v1
 * - Navigations: NetworkFirst → cached document fallback
 * - /assets/*: CacheFirst (revved filenames)
 * - /api/*: NetworkOnly (never cache AI success)
 * - Does not touch OPFS / IndexedDB / evidence blobs
 * - Ignores cross-origin scripts (e.g. grok.com extensions)
 */
const CACHE = 'forenx-shell-v1'

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(PRECACHE)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('forenx-shell-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      )
      // Drop legacy vite-plugin-pwa / workbox caches so they cannot serve stale shells.
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith('workbox-') ||
              key.startsWith('forenx-images') ||
              key.includes('precache'),
          )
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

/**
 * @param {Request} request
 * @param {Response} response
 */
async function putAsset(request, response) {
  if (!response || !response.ok) return
  const cache = await caches.open(CACHE)
  await cache.put(request, response.clone())
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Never intercept cross-origin (extensions, fonts CDN, etc.)
  if (url.origin !== self.location.origin) return

  // AI / API — NetworkOnly; failures propagate so the app can show OFFLINE.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Hashed build assets — CacheFirst
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const fresh = await fetch(request)
        void putAsset(request, fresh)
        return fresh
      })(),
    )
    return
  }

  // Icons / favicon / manifest — CacheFirst with network refresh
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        try {
          const fresh = await fetch(request)
          void putAsset(request, fresh)
          return fresh
        } catch (error) {
          if (cached) return cached
          throw error
        }
      })(),
    )
    return
  }

  // Navigations — NetworkFirst, offline shell fallback
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(CACHE)
          void cache.put('/index.html', fresh.clone())
          return fresh
        } catch {
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'))
          if (cached) return cached
          return new Response('ForenX EvidenceOS is offline.', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      })(),
    )
  }
})
