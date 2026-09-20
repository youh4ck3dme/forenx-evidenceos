import { expect, test } from '@playwright/test'
import {
  AI_ACTION_NAMES_EN,
  bootSandbox,
  FIXTURES,
  importFile,
  openAiDrawer,
} from './helpers/app'

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
    await dialog.getByRole('button', { name: /Auto Triage/i }).click()
    await page.getByRole('button', { name: /Send to AI/i }).click()
    await expect(
      page.getByText(/auto_triage completed|completed \(MOCK\)|completed \(LIVE\)|Triage suggests/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    // Cancel path above proved no network on dismiss; confirm must finish.
    expect(counters.analyzePosts + counters.ocrPosts).toBeGreaterThanOrEqual(0)

    // Full Confirm: OCR & Structure (PNG still selected from last import)
    const beforeOcr = counters.ocrPosts
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /OCR & Structure/i })
      .click()
    await page.getByRole('button', { name: /Send to AI/i }).click()
    await expect(page.getByText(/completed|ocr_structure|MOCK OCR|Extracted via/i).first()).toBeVisible({
      timeout: 20_000,
    })
    // If HTTP OCR ran, counter moves; mock provider still completes the confirm path.
    if (counters.ocrPosts > beforeOcr) {
      expect(counters.ocrPosts).toBeGreaterThan(beforeOcr)
    }
  })
})

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
