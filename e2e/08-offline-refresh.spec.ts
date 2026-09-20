import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile, openAiDrawer } from './helpers/app'

test.describe('08 offline refresh', () => {
  test('Offline Key Facts; Refresh AI status (mocked probe)', async ({
    page,
    context,
  }) => {
    const counters = await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)

    await context.setOffline(true)
    await openAiDrawer(page)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Key Facts/i })
      .click()
    // App short-circuits on navigator.onLine — no confirm, OFFLINE chip/message
    await expect(page.getByText(/OFFLINE/i).first()).toBeVisible({ timeout: 8_000 })
    expect(counters.analyzePosts).toBe(0)

    await context.setOffline(false)
    await page.keyboard.press('Escape')

    await openAiDrawer(page)
    const beforeProbe = counters.probePosts
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Refresh AI status/i })
      .click()
    await expect
      .poll(() => counters.probePosts, { timeout: 10_000 })
      .toBeGreaterThan(beforeProbe)
    await expect(page.getByText(/LIVE|MOCK|IDLE/i).first()).toBeVisible()
  })
})
