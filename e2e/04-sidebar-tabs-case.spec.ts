import { expect, test } from '@playwright/test'
import {
  bootSandbox,
  FIXTURES,
  importFile,
  openCasesDrawer,
  closeDrawer,
} from '../helpers/app'

test.describe('04 sidebar tabs case', () => {
  test('New case, all 5 tabs, select evidence', async ({ page }) => {
    await bootSandbox(page)
    await importFile(page, FIXTURES.invoice)

    await openCasesDrawer(page)
    const dialog = page.getByRole('dialog')

    await dialog.getByRole('button', { name: /^New$/i }).click()
    await expect(dialog.getByText(/# /).first()).toBeVisible()

    for (const tab of ['Evidence', 'Timeline', 'Entities', 'Findings', 'Reports']) {
      await dialog.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click()
    }

    await dialog.getByRole('button', { name: /^Evidence$/i }).click()
    await dialog.getByText('invoice_sample.txt').first().click()
    await closeDrawer(page)

    await expect(page.getByText('invoice_sample.txt').first()).toBeVisible()
    await expect(page.getByText(/SHA256/i).first()).toBeVisible()
  })
})
