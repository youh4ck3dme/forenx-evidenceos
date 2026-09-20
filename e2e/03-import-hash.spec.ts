import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile } from '../helpers/app'

test.describe('03 import hash', () => {
  test('Add Evidence + SHA256 + immutable badge', async ({ page }) => {
    const counters = await bootSandbox(page)
    const before = counters.analyzePosts

    await importFile(page, FIXTURES.invoice)

    await expect(page.getByText(/SHA256/i).first()).toBeVisible()
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/SHA256\s+[a-f0-9]{8,}/i)
    await expect(
      page.getByText(/Original \/ Immutable|Originál \/ Nemenný/i),
    ).toBeVisible()

    expect(counters.analyzePosts).toBe(before)
    expect(counters.ocrPosts).toBe(0)
  })
})
