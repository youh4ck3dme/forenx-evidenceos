import { expect, test } from '@playwright/test'
import { bootSandbox, FIXTURES, importFile } from './helpers/app'

test.describe('06 command palette', () => {
  test('open via StatusBar/keyboard, Add/Audit/Export/Auto Triage+confirm, Esc', async ({
    page,
  }) => {
    const counters = await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)

    // Dock exposes Commands on all widths
    const cmdBtn = page.getByRole('button', { name: /Commands|Príkazy/i })
    await cmdBtn.click()

    await expect(page.getByPlaceholder(/Search or run|Hľadať/i)).toBeVisible()

    await page.getByRole('button', { name: /^Esc$/i }).click()
    await expect(page.getByPlaceholder(/Search or run|Hľadať/i)).toBeHidden()

    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeVisible()

    await expect(page.getByRole('option', { name: /^Add evidence$/i })).toBeVisible()

    await page.getByText(/^Open audit log$/i).click()
    await expect(page.getByRole('dialog').getByText(/Audit/i).first()).toBeVisible()
    await page.keyboard.press('Escape')

    await page.keyboard.press('Control+k')
    await page.getByText(/^Export JSON$/i).click()
    await page.keyboard.press('Control+k')
    await page.getByText(/^Export Markdown$/i).click()

    const before = counters.analyzePosts
    await page.keyboard.press('Control+k')
    await page.getByText(/^Run Auto Triage$/i).click()
    await expect(
      page.getByRole('heading', { name: /Send evidence to AI/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Cancel$/i }).click()
    expect(counters.analyzePosts).toBe(before)

    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/Search or run/i)).toBeHidden()
  })
})
