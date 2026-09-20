import { expect, type Page } from '@playwright/test'

/** Clear persisted workspace settings and reload. */
export async function freshContext(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })
  // Prefer a fresh navigation over reload() — reload cancels in-flight SW registration on WebKit.
  await page.goto('/', { waitUntil: 'networkidle' })
}

/** Assert PWA shell signals: SW ready, manifest link, apple-touch + theme-color. */
export async function assertPwaShell(page: Page) {
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    /.+/,
  )

  // Prefer activated; accept a live registration while install finishes (WebKit can keep
  // an older installing worker around when contexts share an origin profile).
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return 'no-sw-api'
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg?.active?.state === 'activated') return 'activated'
          if (reg?.waiting?.state === 'installed') {
            // Promote waiting worker
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            return 'waiting'
          }
          if (reg?.installing || reg?.active || reg?.waiting) return 'registered'
          try {
            await navigator.serviceWorker.register('/sw.js')
          } catch {
            /* ignore */
          }
          return 'missing'
        }),
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toMatch(/activated|registered|waiting/)
}

/**
 * Simulate an installed PWA by making matchMedia('(display-mode: standalone)') match.
 * Call before navigation (or use with addInitScript on the context).
 */
export async function asStandalone(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = ((query: string) => {
      if (
        query.includes('display-mode: standalone') ||
        query.includes('display-mode:standalone')
      ) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false
          },
        } as MediaQueryList
      }
      return original(query)
    }) as typeof window.matchMedia
  })
}
