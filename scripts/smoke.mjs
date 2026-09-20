import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
const FIXTURE = '/tmp/forenx-fixtures/invoice_sample.txt'
const OUT = '/opt/cursor/artifacts'

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('screenshot', file)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await shot(page, 'forenx_welcome')
  await page.getByRole('button', { name: /Vstúpiť do sandboxu|Enter Sandbox/i }).click()
  await page.waitForURL('**/sandbox')
  await page.waitForTimeout(1000)
  await shot(page, 'forenx_sandbox_empty')

  await page.locator('input[type="file"]').setInputFiles(FIXTURE)
  await page.getByText('invoice_sample.txt').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  await shot(page, 'forenx_evidence_imported')

  await page.getByRole('button', { name: /Auto triáž|Auto Triage/i }).click()
  await page.getByText(/Triage suggests|dokončené|completed|FINANCIAL/i).first().waitFor({ timeout: 15000 })
  await shot(page, 'forenx_auto_triage_finding')

  await page.getByRole('button', { name: /Audit/i }).click()
  await page.getByText(/EVIDENCE_IMPORTED|CASE_CREATED|EVIDENCE_HASHED/i).first().waitFor({ timeout: 8000 })
  await shot(page, 'forenx_audit_drawer')
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/Hľadať|Search or run/i).waitFor({ timeout: 5000 })
  await shot(page, 'forenx_command_palette')
  await page.getByRole('button', { name: /^Esc$/i }).click()
  await page.waitForTimeout(200)

  await page.getByRole('button', { name: /^MD$/i }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /Audit/i }).click()
  await page.getByText(/EXPORT_CREATED/i).first().waitFor({ timeout: 8000 })
  await shot(page, 'forenx_export_audit')

  console.log('SMOKE_OK')
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
