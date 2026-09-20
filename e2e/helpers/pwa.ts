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

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return 'no-sw-api'
          const ready = await navigator.serviceWorker.ready
          return ready?.active?.state ?? 'missing'
        }),
      { timeout: 45_000 },
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
