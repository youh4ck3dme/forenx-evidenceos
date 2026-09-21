import { expect, test } from '@playwright/test'
import { bootSandbox, closeDrawer, openAiDrawer, openCasesDrawer } from './helpers/app'

test.describe('02 mobile shell drawers', () => {
  test('Cases/AI drawers open+close (X), Lang inside', async ({ page }) => {
    await bootSandbox(page)

    await openCasesDrawer(page)
    await expect(page.getByRole('dialog').getByText(/Cases & Evidence|Prípady/i)).toBeVisible()
    // Language switcher inside drawer
    await expect(page.getByRole('dialog').getByRole('button', { name: /^SK$/i })).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button', { name: /^EN$/i })).toBeVisible()
    await closeDrawer(page)

    await openAiDrawer(page)
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Auto Triage|Auto triáž/i }),
    ).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /^SK$/i }).click()
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Auto triáž/i }),
    ).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /^EN$/i }).click()
    await closeDrawer(page)

    // Overlay close: Cases drawer is left-aligned (~420px); click the uncovered right strip.
    await openCasesDrawer(page)
    await page.mouse.click(422, 120)
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
