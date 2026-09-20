import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { freshContext } from './pwa'
import { installAiRouteMock, type AiMockCounters } from './aiMock'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES = {
  invoice: path.resolve(HERE, '../fixtures/invoice_sample.txt'),
  png: path.resolve(HERE, '../fixtures/scan_sample.png'),
  pdf: path.resolve(HERE, '../fixtures/sample_multipage.pdf'),
}

export async function bootSandbox(
  page: Page,
  opts: { locale?: 'en' | 'sk'; mockAi?: boolean } = {},
): Promise<AiMockCounters> {
  const counters: AiMockCounters = {
    analyzePosts: 0,
    ocrPosts: 0,
    probePosts: 0,
  }
  if (opts.mockAi !== false) {
    await installAiRouteMock(page, counters)
  }

  await freshContext(page)
  await expect(page.getByRole('button', { name: /Vstúpiť do sandboxu|Enter Sandbox/i })).toBeVisible({
    timeout: 30_000,
  })

  if (opts.locale === 'en') {
    await page.getByRole('button', { name: /^EN$/i }).click()
    await expect(page.getByRole('button', { name: /Enter Sandbox/i })).toBeVisible()
    await page.getByRole('button', { name: /Enter Sandbox/i }).click()
  } else {
    await page.getByRole('button', { name: /Vstúpiť do sandboxu/i }).click()
  }

  await page.waitForURL('**/sandbox')
  await expect(
    page.getByRole('button', { name: /\+ Add Evidence|\+ Pridať dôkaz/i }),
  ).toBeVisible({ timeout: 20_000 })

  // Prefer EN for stable selectors in most journeys
  if (opts.locale !== 'sk') {
    const enBtn = page.getByRole('button', { name: /^EN$/i }).last()
    if (await enBtn.isVisible().catch(() => false)) {
      await enBtn.click()
      await expect(page.getByRole('button', { name: /\+ Add Evidence/i })).toBeVisible()
    }
  }

  return counters
}

export async function openAiDrawer(page: Page) {
  await page.getByRole('button', { name: /^AI$/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText(/ForenX AI/i).first()).toBeVisible()
}

export async function closeDrawer(page: Page) {
  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible().catch(() => false))) return
  // Mobile WebKit often reports the header X as outside the layout viewport —
  // force-click, then fall back to Escape.
  const closeBtn = dialog.locator('button').first()
  try {
    await closeBtn.click({ force: true, timeout: 3_000 })
  } catch {
    await page.keyboard.press('Escape')
  }
  await expect(dialog).toBeHidden()
}

export async function openCasesDrawer(page: Page) {
  await page.getByRole('button', { name: /^Cases$|^Prípady$/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: /^New$|^Nový$/i })).toBeVisible()
}

export async function importFile(page: Page, filePath: string) {
  await page.locator('input[type="file"]').setInputFiles(filePath)
  const name = path.basename(filePath)
  // Case sidebar is lg-only (hidden on iPhone width); assert via main viewer.
  await expect(page.locator('main').getByText(name).first()).toBeVisible({
    timeout: 20_000,
  })
}

export async function openConfirmCancel(page: Page, actionName: RegExp | string) {
  await page.getByRole('button', { name: actionName }).click()
  await expect(
    page.getByRole('heading', { name: /Send evidence to AI|Odoslať dôkaz do AI/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Cancel|Zrušiť/i }).click()
  await expect(
    page.getByRole('heading', { name: /Send evidence to AI|Odoslať dôkaz do AI/i }),
  ).toBeHidden()
}

export const AI_ACTION_NAMES_EN = [
  'Auto Triage',
  'Document Classify',
  'OCR & Structure',
  'Metadata Analysis',
  'Executive Summary',
  'Key Facts',
  'Entity Extraction',
  'Timeline',
  'Relationship Map',
  'Contradictions',
  'Duplicate Review',
  'PII & Secret Review',
  'Financial Analysis',
  'Communication Analysis',
  'Contract Analysis',
  'Technical IOC',
  'Authenticity Review',
  'Evidence Gaps',
  'Investigator Questions',
  'Case Report',
] as const
