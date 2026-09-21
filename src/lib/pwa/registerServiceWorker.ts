/**
 * Registers the ForenX offline shell service worker (`/sw.js`).
 * Auto-updates on new deploy (skipWaiting + one controllerchange reload).
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  let refreshing = false
  // First install also fires controllerchange — only reload on subsequent updates.
  let hadController = Boolean(navigator.serviceWorker.controller)

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      if (import.meta.env.DEV) {
        console.info('[ForenX PWA] SW registered', registration.scope)
      }

      window.setInterval(
        () => {
          void registration.update()
        },
        60 * 60 * 1000,
      )

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    })
    .catch((error: unknown) => {
      console.warn('[ForenX PWA] SW registration failed', error)
    })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
