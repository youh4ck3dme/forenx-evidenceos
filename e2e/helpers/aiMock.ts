import type { Page, Route } from '@playwright/test'

export type AiMockCounters = {
  analyzePosts: number
  ocrPosts: number
  probePosts: number
}

const MOCK_ANALYZE = {
  model: 'forenx-mock-route',
  choices: [
    {
      message: {
        content: JSON.stringify({
          statement: 'Triage suggests FINANCIAL for invoice_sample.txt',
          epistemicClass: 'OBSERVED',
          confidence: 0.81,
          sourceReferences: [
            { evidenceId: 'mock', fileName: 'invoice_sample.txt' },
          ],
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
}

const MOCK_OCR = {
  model: 'forenx-mock-ocr-route',
  pages: [
    {
      markdown:
        'MOCK OCR PAGE\nInvoice amount EUR 12,450.00\nIBAN SK31 1200 0000 1987 4263 7541',
    },
  ],
}

/** Mock /api/ai/** — same pattern as scripts/regression.mjs (no live key). */
export async function installAiRouteMock(
  page: Page,
  counters: AiMockCounters = { analyzePosts: 0, ocrPosts: 0, probePosts: 0 },
): Promise<AiMockCounters> {
  // Context-level route intercepts requests even when a service worker is active.
  await page.context().route('**/api/ai/**', async (route: Route) => {
    const req = route.request()
    if (req.method() !== 'POST') {
      await route.continue()
      return
    }

    const url = req.url()
    const isOcr = url.includes('/ocr')
    let body: Record<string, unknown> = {}
    try {
      body = req.postDataJSON() as Record<string, unknown>
    } catch {
      body = {}
    }

    if (body?.probe) {
      counters.probePosts += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, mode: 'live' }),
      })
      return
    }

    if (isOcr) {
      counters.ocrPosts += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OCR),
      })
      return
    }

    counters.analyzePosts += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ANALYZE),
    })
  })

  return counters
}
