import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the Workbox service worker with auto-update.
 * Icons + app shell are precached; /api/* stays NetworkOnly.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (import.meta.env.DEV) {
        console.info('[ForenX PWA] SW registered', swUrl, registration?.scope)
      }
      // Periodically check for a new SW so installed PWAs pick up icon/manifest updates.
      if (registration) {
        window.setInterval(
          () => {
            void registration.update()
          },
          60 * 60 * 1000,
        )
      }
    },
    onRegisterError(error) {
      console.warn('[ForenX PWA] SW registration failed', error)
    },
  })
}
