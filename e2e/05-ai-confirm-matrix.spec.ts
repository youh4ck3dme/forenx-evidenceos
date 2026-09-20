import { expect, test } from '@playwright/test'
import {
  AI_ACTION_NAMES_EN,
  bootSandbox,
  FIXTURES,
  importFile,
  openAiDrawer,
} from '../helpers/app'

test.describe('05 AI confirm matrix', () => {
  test('each AI action Cancel wire-check; Auto Triage + OCR full Confirm; Esc', async ({
    page,
  }) => {
    const counters = await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)
    await importFile(page, FIXTURES.png)

    await openAiDrawer(page)
    const dialog = page.getByRole('dialog')

    // Wire check: every action opens confirm; Cancel must not call AI
    for (const name of AI_ACTION_NAMES_EN) {
      const beforeA = counters.analyzePosts
      const beforeO = counters.ocrPosts
      await dialog.getByRole('button', { name: new RegExp(escapeRe(name)) }).click()
      await expect(
        page.getByRole('heading', { name: /Send evidence to AI/i }),
      ).toBeVisible()
      await page.getByRole('button', { name: /^Cancel$/i }).click()
      await expect(
        page.getByRole('heading', { name: /Send evidence to AI/i }),
      ).toBeHidden()
      expect(counters.analyzePosts).toBe(beforeA)
      expect(counters.ocrPosts).toBe(beforeO)
    }

    // Esc cancel
    const beforeEsc = counters.analyzePosts
    await dialog.getByRole('button', { name: /Auto Triage/i }).click()
    await expect(
      page.getByRole('heading', { name: /Send evidence to AI/i }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('heading', { name: /Send evidence to AI/i }),
    ).toBeHidden()
    expect(counters.analyzePosts).toBe(beforeEsc)

    // Full Confirm: Auto Triage
    const beforeTriage = counters.analyzePosts
    await dialog.getByRole('button', { name: /Auto Triage/i }).click()
    await page.getByRole('button', { name: /Send to AI/i }).click()
    await expect
      .poll(() => counters.analyzePosts, { timeout: 20_000 })
      .toBeGreaterThan(beforeTriage)
    await expect(page.getByText(/completed|FINANCIAL|Triage/i).first()).toBeVisible({
      timeout: 20_000,
    })

    // Full Confirm: OCR & Structure (image selected — re-select via Cases if needed)
    // Evidence selection: last import may be selected; ensure PNG is selected
    await page.keyboard.press('Escape') // close AI drawer if still open
    await page.getByRole('button', { name: /^Cases$/i }).click()
    await page.getByRole('dialog').getByText('scan_sample.png').first().click()
    await page.keyboard.press('Escape')

    await openAiDrawer(page)
    const beforeOcr = counters.ocrPosts
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /OCR & Structure/i })
      .click()
    await page.getByRole('button', { name: /Send to AI/i }).click()
    await expect
      .poll(() => counters.ocrPosts, { timeout: 20_000 })
      .toBeGreaterThan(beforeOcr)
  })
})

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
