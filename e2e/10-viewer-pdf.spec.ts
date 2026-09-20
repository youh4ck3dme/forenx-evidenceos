import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile } from '../helpers/app'

test.describe('10 viewer PDF', () => {
  test('multi-page PDF Prev/Next', async ({ page }) => {
    await bootSandbox(page)
    await importFile(page, FIXTURES.pdf)

    await expect(page.getByText('sample_multipage.pdf').first()).toBeVisible()
    await expect(page.getByText(/page\s+1\s*\/\s*2/i)).toBeVisible({
      timeout: 30_000,
    })

    await page.getByRole('button', { name: /^Next$/i }).click()
    await expect(page.getByText(/page\s+2\s*\/\s*2/i)).toBeVisible()

    await page.getByRole('button', { name: /^Prev$/i }).click()
    await expect(page.getByText(/page\s+1\s*\/\s*2/i)).toBeVisible()
  })
})
