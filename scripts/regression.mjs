#!/usr/bin/env node
/**
 * ForenX EvidenceOS regression suite (Playwright).
 * Default: mock AI via route fulfill (no live key required).
 * Opt-in live: LIVE_AI=1 with MISTRAL_API_KEY in env / .env.local (server already loaded by Vite).
 */
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const BASE = process.env.FORENX_BASE_URL ?? 'http://127.0.0.1:5173'
const FIXTURE = '/tmp/forenx-fixtures/invoice_sample.txt'
const OUT = '/opt/cursor/artifacts'
const LIVE_AI = process.env.LIVE_AI === '1'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('screenshot', file)
}

async function main() {
  fs.mkdirSync('/tmp/forenx-fixtures', { recursive: true })
  if (!fs.existsSync(FIXTURE)) {
    fs.writeFileSync(
      FIXTURE,
      [
        'INVOICE #INV-2024-0042',
        'From: finance@acme.example',
        'To: accounts@contoso.example',
        'Date: 2024-03-15',
        'Amount due: EUR 12,450.00',
        'IBAN: SK31 1200 0000 1987 4263 7541',
        'Please remit payment within 30 days.',
      ].join('\n'),
    )
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const aiPosts = []
  await page.route('**/api/ai/**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      aiPosts.push({ url: req.url(), postData: req.postData() })
      const body = req.postDataJSON?.() ?? {}
      if (body?.probe) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, mode: 'live' }),
        })
        return
      }
      if (LIVE_AI) {
        await route.continue()
        return
      }
      // Mock structured triage-ish payload
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          model: 'forenx-mock-route',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  statement: 'Triage suggests FINANCIAL for invoice_sample.txt',
                  epistemicClass: 'OBSERVED',
                  confidence: 0.81,
                  sourceReferences: [{ evidenceId: 'mock', fileName: 'invoice_sample.txt' }],
                  primaryCategory: 'FINANCIAL',
                  secondaryCategories: [],
                  mediaType: 'text/plain',
                  apparentPurpose: 'invoice',
                  languages: ['en'],
                  peopleOrganizationsSystems: [],
                  dateRange: '2024-03-15',
                  ocrQualitySufficient: true,
                  additionalParsingRequired: false,
                  sensitiveInformationPresent: true,
                  relatedEvidenceHints: [],
                  recommendedNextActions: ['KEY_FACTS'],
                  workspaceSection: 'FINANCIAL',
                }),
              },
            },
          ],
        }),
      })
      return
    }
    await route.continue()
  })

  // Fresh state
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })

  // 1) Welcome SK default
  await page.getByRole('button', { name: /Vstúpiť do sandboxu/i }).waitFor()
  assert(await page.getByText('FORENX').first().isVisible(), 'FORENX brand visible')
  await shot(page, 'regression_welcome_sk')

  // 2) Locale switch SK -> EN on welcome
  await page.getByRole('button', { name: /^EN$/i }).click()
  await page.getByRole('button', { name: /Enter Sandbox/i }).waitFor()
  await shot(page, 'regression_welcome_en')
  await page.getByRole('button', { name: /^SK$/i }).click()
  await page.getByRole('button', { name: /Vstúpiť do sandboxu/i }).click()
  await page.waitForURL('**/sandbox')
  await page.waitForTimeout(1000)

  // 3) No auto AI traffic after mount
  const postsBefore = aiPosts.length
  await page.waitForTimeout(1500)
  assert(
    aiPosts.length === postsBefore,
    `Expected no auto AI posts after mount, got ${aiPosts.length - postsBefore}`,
  )
  console.log('OK no-auto-AI')

  // Persist locale check: switch to EN in sandbox status bar
  await page.getByRole('button', { name: /^EN$/i }).last().click()
  await page.getByRole('button', { name: /\+ Add Evidence/i }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  assert(
    await page.getByRole('button', { name: /\+ Add Evidence/i }).isVisible(),
    'EN persisted after reload',
  )
  await page.getByRole('button', { name: /^SK$/i }).last().click()
  await page.getByRole('button', { name: /\+ Pridať dôkaz/i }).waitFor()
  console.log('OK locale switch + persist')

  // 4) Import evidence
  await page.locator('input[type="file"]').setInputFiles(FIXTURE)
  await page.getByText('invoice_sample.txt').first().waitFor({ timeout: 15000 })
  assert(await page.getByText(/SHA256/i).isVisible(), 'SHA visible')
  assert(
    await page.getByText(/Originál \/ Nemenný|Original \/ Immutable/i).isVisible(),
    'immutable badge',
  )
  await shot(page, 'regression_evidence_imported')
  console.log('OK import')

  const postsAfterImport = aiPosts.length
  assert(postsAfterImport === postsBefore, 'Import must not call AI')

  // 5) AI on click — confirm dialog required; cancel must not call AI
  const postsBeforeTriage = aiPosts.length
  await page.getByRole('button', { name: /Auto triáž|Auto Triage/i }).click()
  await page.getByRole('heading', { name: /Odoslať dôkaz do AI|Send evidence to AI/i }).waitFor()
  await page.getByRole('button', { name: /Zrušiť|Cancel/i }).click()
  await page.waitForTimeout(400)
  assert(
    aiPosts.length === postsBeforeTriage,
    'Cancel confirm must not call AI',
  )

  await page.getByRole('button', { name: /Auto triáž|Auto Triage/i }).click()
  await page.getByRole('button', { name: /Odoslať do AI|Send to AI/i }).click()
  await page
    .getByText(/Triage suggests|dokončené|completed|FINANCIAL/i)
    .first()
    .waitFor({ timeout: 20000 })
  const analyzeCalls = aiPosts.filter((p) => {
    try {
      const body = JSON.parse(p.postData || '{}')
      return !body.probe
    } catch {
      return true
    }
  })
  assert(analyzeCalls.length >= 1, 'Expected at least one analyze call after click')
  // Should not have piled up many probes
  console.log('AI posts total', aiPosts.length, 'analyze-ish', analyzeCalls.length)
  await shot(page, 'regression_auto_triage')
  console.log('OK AI on-click')

  // 6) Offline AI — no fake success
  await context.setOffline(true)
  await page.getByRole('button', { name: /Kľúčové fakty|Key Facts/i }).click()
  await page.waitForTimeout(800)
  const body = await page.locator('body').innerText()
  assert(/OFFLINE/i.test(body), 'Offline status/message expected')
  await context.setOffline(false)
  console.log('OK offline AI')

  // 7) Command palette
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/Hľadať|Search or run/i).waitFor()
  await shot(page, 'regression_command_palette')
  await page.getByRole('button', { name: /^Esc$/i }).click()
  console.log('OK command palette')

  // 8) Export
  await page.getByRole('button', { name: /^MD$/i }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /Audit/i }).click()
  await page.getByText(/EXPORT_CREATED/i).first().waitFor({ timeout: 8000 })
  await shot(page, 'regression_export_audit')
  console.log('OK export')

  // Optional live AI probe via Refresh button
  if (LIVE_AI) {
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Obnoviť AI status|Refresh AI status/i }).click()
    await page.waitForTimeout(1500)
    const liveBody = await page.locator('body').innerText()
    assert(/Mistral LIVE/i.test(liveBody), 'Expected LIVE after manual refresh')
    console.log('OK LIVE_AI refresh')
  }

  console.log('REGRESSION_OK')
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
