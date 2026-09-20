import { expect, test } from '@playwright/test'
import { freshContext } from './helpers/pwa'

test.describe('01 welcome theme locale', () => {
  test('theme Dark/Light, SK/EN, Enter Sandbox', async ({ page }) => {
    await freshContext(page)

    await expect(page.getByText('FORENX').first()).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: /Vstúpiť do sandboxu/i }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Svetlý|Light/i }).click()
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('light')

    await page.getByRole('button', { name: /Tmavý|Dark/i }).click()
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark')

    await page.getByRole('button', { name: /^EN$/i }).click()
    await expect(page.getByRole('button', { name: /Enter Sandbox/i })).toBeVisible()

    await page.getByRole('button', { name: /^SK$/i }).click()
    await expect(
      page.getByRole('button', { name: /Vstúpiť do sandboxu/i }),
    ).toBeVisible()

    await page.getByRole('button', { name: /^EN$/i }).click()
    await page.getByRole('button', { name: /Enter Sandbox/i }).click()
    await page.waitForURL('**/sandbox')
    await expect(
      page.getByRole('button', { name: /\+ Add Evidence/i }),
    ).toBeVisible({ timeout: 20_000 })
  })
})
