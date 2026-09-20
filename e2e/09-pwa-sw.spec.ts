import { expect, test } from '@playwright/test'
import { asStandalone, assertPwaShell, freshContext } from '../helpers/pwa'
import { bootSandbox, FIXTURES, importFile, openAiDrawer } from '../helpers/app'
import { installAiRouteMock } from '../helpers/aiMock'

test.describe('09 PWA service worker', () => {
  test('SW ready, manifest JSON, NetworkOnly /api offline fails honestly', async ({
    page,
    context,
  }) => {
    await asStandalone(page)
    await freshContext(page)
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

    // NetworkOnly /api: without route mock, offline POST must fail (not fake-cached)
    await page.unroute('**/api/ai/**').catch(() => {})
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

    // App-level offline analyze also fails honestly (no success toast)
    const counters = { analyzePosts: 0, ocrPosts: 0, probePosts: 0 }
    await installAiRouteMock(page, counters)
    // Re-enter sandbox path with evidence
    await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)
    await context.setOffline(true)
    await openAiDrawer(page)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Auto Triage/i })
      .click()
    await expect(page.getByText(/OFFLINE/i).first()).toBeVisible()
    expect(counters.analyzePosts).toBe(0)
  })
})
