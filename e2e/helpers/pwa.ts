import { expect, type Page } from '@playwright/test'

/** Clear persisted workspace settings and reload. */
export async function freshContext(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Assert PWA shell signals: SW ready, manifest link, apple-touch + theme-color. */
export async function assertPwaShell(page: Page) {
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    /.+/,
  )

    // Prefer getRegistration over ready — ready can hang if registration is mid-flight.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return 'no-sw-api'
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg?.active?.state === 'activated') return 'activated'
          if (reg?.installing || reg?.waiting) return 'installing'
          return 'missing'
        }),
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBe('activated')
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
