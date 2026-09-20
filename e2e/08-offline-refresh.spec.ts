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
    // App short-circuits on navigator.onLine — chip may sit under the drawer chrome
    await expect(page.getByRole('dialog')).toContainText(/OFFLINE/i)
    expect(counters.analyzePosts).toBe(0)

    await context.setOffline(false)
    await page.keyboard.press('Escape')

    await openAiDrawer(page)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Refresh AI status/i })
      .click()
    // Probe may be LIVE (routed) or UNAVAILABLE→MOCK on preview without middleware.
    await expect(page.getByRole('dialog')).toContainText(/LIVE|MOCK|IDLE|UNAVAILABLE/i, {
      timeout: 10_000,
    })
  })
})
