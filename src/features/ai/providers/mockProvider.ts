import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiConnectionStatus,
  AiOcrRequest,
  AiOcrResponse,
  AiProvider,
} from '../provider'
import { wrapEvidenceAsUntrusted } from '@/lib/security/evidence'
import { FORENX_CORE_SYSTEM_PROMPT } from '../prompts/core'

function mockPayload(request: AiAnalyzeRequest): Record<string, unknown> {
  const evidence = request.evidenceContext[0]
  const fileName = evidence?.fileName ?? 'unknown'
  const text = evidence?.extractedText ?? ''
  const snippet = text.slice(0, 240).replace(/\s+/g, ' ').trim()
  const evidenceId = evidence?.evidenceId ?? 'unknown'
  const lower = `${fileName} ${text}`.toLowerCase()

  let workspaceSection = 'OTHER'
  if (/invoice|payment|iban|amount|usd|eur|\$/.test(lower)) workspaceSection = 'FINANCIAL'
  else if (/contract|agreement|party|obligation/.test(lower)) workspaceSection = 'CONTRACT'
  else if (/email|from:|to:|subject:|message/.test(lower)) workspaceSection = 'COMMUNICATION'
  else if (/ip|hash|cve|registry|hostname/.test(lower)) workspaceSection = 'TECHNICAL'
  else if (/\.(png|jpe?g|webp|heic)$/i.test(fileName)) workspaceSection = 'MEDIA'

  const base = {
    statement: `Mock analysis of ${fileName}`,
    epistemicClass: snippet ? 'OBSERVED' : 'UNKNOWN',
    confidence: snippet ? 0.72 : 0.35,
    sourceReferences: [
      {
        evidenceId,
        fileName,
        note: 'Derived from local mock provider (no remote model call)',
      },
    ],
  }

  switch (request.action.id) {
    case 'auto_triage':
      return {
        ...base,
        statement: `Triage suggests ${workspaceSection} for ${fileName}`,
        primaryCategory: workspaceSection,
        secondaryCategories: [],
        mediaType: evidence?.mime ?? 'unknown',
        apparentPurpose: snippet
          ? 'Document appears to contain investigative content'
          : 'Insufficient extracted text',
        languages: ['en'],
        peopleOrganizationsSystems: [],
        dateRange: null,
        ocrQualitySufficient: text.length > 40,
        additionalParsingRequired: text.length < 20,
        sensitiveInformationPresent: /ssn|password|api[_-]?key|iban/i.test(text)
          ? true
          : false,
        relatedEvidenceHints: [],
        recommendedNextActions: ['KEY_FACTS', 'ENTITY_EXTRACTION', 'TIMELINE'],
        workspaceSection,
        confidence: snippet ? 0.78 : 0.4,
      }
    case 'key_facts':
      return {
        ...base,
        facts: snippet
          ? [
              {
                factId: 'fact_1',
                statement: snippet.slice(0, 160),
                epistemicClass: 'OBSERVED',
                subjects: [],
                objects: [],
                dateOrTime: null,
                location: null,
                sourceReferences: base.sourceReferences,
                confidence: 0.7,
              },
            ]
          : [],
      }
    case 'entity_extraction': {
      const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
      return {
        ...base,
        entities: emails.slice(0, 5).map((email) => ({
          canonicalValue: email.toLowerCase(),
          originalRepresentation: email,
          entityType: 'EMAIL',
          aliases: [],
          sourceReferences: base.sourceReferences,
          confidence: 0.9,
        })),
      }
    }
    case 'timeline':
      return {
        ...base,
        events: [],
        chronologicalConflicts: [],
      }
    case 'case_report':
      return {
        ...base,
        statement: `Mock case report for ${request.caseContext.reference}`,
        sections: {
          caseOverview: request.caseContext.description || request.caseContext.name,
          evidenceInventory: `${request.evidenceContext.length} evidence item(s) analyzed in mock mode.`,
          examinationMethodology:
            'Local mock provider — structured output only; not a live model analysis.',
          keyObservedFacts: snippet ? [snippet.slice(0, 120)] : [],
          entityOverview: 'See entity extraction results.',
          timeline: 'See timeline results.',
          materialRelationships: 'Insufficient corroboration in mock mode.',
          contradictions: [],
          anomaliesRequiringReview: [],
          evidenceGaps: ['Live model analysis not performed'],
          investigativeHypotheses: [],
          recommendedVerificationSteps: ['Re-run with LIVE Mistral provider'],
          limitations: 'Mock mode generates deterministic structured placeholders.',
          evidenceCoverageAssessment: 'Partial — mock provider only.',
        },
      }
    default:
      return {
        ...base,
        items: snippet
          ? [
              {
                label: 'excerpt',
                value: snippet,
                epistemicClass: 'OBSERVED',
                confidence: 0.65,
              },
            ]
          : [],
        unresolvedQuestions: ['Run with LIVE provider for full analysis'],
      }
  }
}

export class MockAiProvider implements AiProvider {
  readonly id = 'mock'

  async getStatus(): Promise<AiConnectionStatus> {
    return 'MOCK'
  }

  async ocr(request: AiOcrRequest): Promise<AiOcrResponse> {
    await new Promise((r) => setTimeout(r, 200))
    // Honest mock: derived placeholder text, clearly labeled — not LIVE OCR.
    return {
      status: 'MOCK',
      model: 'forenx-mock-ocr',
      modelVersion: '0.1.0',
      text: [
        `[MOCK OCR] ${request.fileName}`,
        'No remote Document AI call was made.',
        'Replace with LIVE Mistral OCR when MISTRAL_API_KEY is configured.',
        `Kind=${request.kind} bytes≈${Math.round((request.base64.length * 3) / 4)}`,
      ].join('\n'),
      pageCount: 1,
      ocrConfidence: 0.2,
    }
  }

  async analyze(request: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
    // Ensure evidence wrapping path is exercised (security contract)
    void FORENX_CORE_SYSTEM_PROMPT
    for (const item of request.evidenceContext) {
      void wrapEvidenceAsUntrusted(item.extractedText)
    }

    await new Promise((r) => setTimeout(r, 350))
    const result = mockPayload(request)
    const parsed = request.action.outputSchema.safeParse(result)
    return {
      status: 'MOCK',
      model: 'forenx-mock',
      modelVersion: '0.1.0',
      promptVersion: request.action.promptVersion,
      result: (parsed.success ? parsed.data : result) as Record<string, unknown>,
    }
  }
}
