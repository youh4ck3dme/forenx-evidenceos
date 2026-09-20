import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile } from './helpers/app'

test.describe('06 command palette', () => {
  test('open via StatusBar/keyboard, Add/Audit/Export/Auto Triage+confirm, Esc', async ({
    page,
  }) => {
    const counters = await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)

    // iPhone 14 Plus is 428px — ⌘K StatusBar button is sm+ (hidden). Use keyboard.
    const cmdBtn = page.getByRole('button', { name: /Command|⌘K/i })
    if (await cmdBtn.isVisible().catch(() => false)) {
      await cmdBtn.click()
    } else {
      await page.keyboard.press('Meta+k')
    }

    await expect(page.getByPlaceholder(/Search or run|Hľadať/i)).toBeVisible()

    // Esc button in palette footer
    await page.getByRole('button', { name: /^Esc$/i }).click()
    await expect(page.getByPlaceholder(/Search or run|Hľadať/i)).toBeHidden()

    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeVisible()

    // Add evidence item exists
    await expect(page.getByText(/Add evidence/i)).toBeVisible()

    // Open audit via palette
    await page.getByText(/^Open audit log$/i).click()
    await expect(page.getByRole('dialog').getByText(/Audit/i).first()).toBeVisible()
    await page.keyboard.press('Escape')

    // Export via palette
    await page.keyboard.press('Control+k')
    await page.getByText(/^Export JSON$/i).click()
    await page.keyboard.press('Control+k')
    await page.getByText(/^Export Markdown$/i).click()

    // Auto Triage + confirm (cancel)
    const before = counters.analyzePosts
    await page.keyboard.press('Control+k')
    await page.getByText(/^Run Auto Triage$/i).click()
    await expect(
      page.getByRole('heading', { name: /Send evidence to AI/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Cancel$/i }).click()
    expect(counters.analyzePosts).toBe(before)

    // Esc closes palette if reopened
    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeHidden()
  })
})
