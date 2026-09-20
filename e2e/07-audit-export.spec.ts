import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile } from './helpers/app'

test.describe('07 audit export', () => {
  test('Audit open/close; JSON+MD export → EXPORT_CREATED', async ({ page }) => {
    await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)

    await page.getByRole('button', { name: /^JSON$/i }).click()
    await page.getByRole('button', { name: /^MD$/i }).click()

    await page.getByRole('button', { name: /Audit/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/EXPORT_CREATED/i).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
