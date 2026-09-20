import { expect, test } from '@playwright/test'
import { asStandalone, assertPwaShell, freshContext } from './helpers/pwa'
import { bootSandbox, FIXTURES, importFile, openAiDrawer } from './helpers/app'

test.describe('09 PWA service worker', () => {
  test('SW ready, manifest JSON, NetworkOnly /api offline fails honestly', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000)
    await asStandalone(page)
    await freshContext(page)
    await page.waitForLoadState('networkidle')

    // Soft-reload so Workbox can finish installing the lean precache.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const state = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'no-sw-api'
        const reg = await navigator.serviceWorker.getRegistration()
        return reg?.active?.state ?? reg?.installing?.state ?? reg?.waiting?.state ?? 'missing'
      })
      if (state === 'activated') break
      await page.waitForTimeout(2000)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1000)
    }
    await assertPwaShell(page)

    const standalone = await page.evaluate(() =>
      window.matchMedia('(display-mode: standalone)').matches,
    )
    expect(standalone).toBe(true)

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href')
    expect(manifestHref).toBeTruthy()
    const manifestUrl = new URL(manifestHref!, page.url()).toString()
    const res = await page.request.get(manifestUrl)
    expect(res.ok()).toBeTruthy()
    const manifest = await res.json()
    expect(manifest.name || manifest.short_name).toBeTruthy()
    expect(manifest.display).toMatch(/standalone/i)

    // NetworkOnly /api: offline POST must fail (not served from SW cache)
    await context.setOffline(true)
    const offlineResult = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'test', messages: [] }),
        })
        return { ok: r.ok, status: r.status, error: null as string | null }
      } catch (e) {
        return {
          ok: false,
          status: 0,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })
    expect(offlineResult.ok).toBe(false)
    await context.setOffline(false)

    // App-level offline analyze also fails honestly (no confirm / no network)
    await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)
    await context.setOffline(true)
    await openAiDrawer(page)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Auto Triage/i })
      .click()
    await expect(page.getByRole('dialog')).toContainText(/OFFLINE/i)
    await expect(
      page.getByRole('heading', { name: /Send evidence to AI/i }),
    ).toBeHidden()
  })
})
