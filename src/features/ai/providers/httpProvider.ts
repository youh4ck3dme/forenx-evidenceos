import { FORENX_CORE_SYSTEM_PROMPT, PROMPT_VERSION } from '../prompts/core'
import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiConnectionStatus,
  AiProvider,
} from '../provider'
import { wrapEvidenceAsUntrusted } from '@/lib/security/evidence'

export class HttpAiProvider implements AiProvider {
  readonly id = 'http'

  async getStatus(): Promise<AiConnectionStatus> {
    if (!navigator.onLine) return 'OFFLINE'
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 2500)
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ probe: true }),
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      if (!res.ok) return 'UNAVAILABLE'
      const data = (await res.json()) as { ok?: boolean; mode?: string }
      if (data.ok && data.mode === 'live') return 'LIVE'
      return 'UNAVAILABLE'
    } catch {
      return navigator.onLine ? 'UNAVAILABLE' : 'OFFLINE'
    }
  }

  async analyze(request: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
    if (!navigator.onLine) {
      throw Object.assign(new Error('Offline — AI actions unavailable'), {
        status: 'OFFLINE' as const,
      })
    }

    const evidenceBlocks = request.evidenceContext
      .map(
        (e) =>
          `Evidence ${e.evidenceId} (${e.fileName}, ${e.mime}, sha256=${e.sha256})\n` +
          wrapEvidenceAsUntrusted(e.extractedText),
      )
      .join('\n\n')

    const messages = [
      {
        role: 'system',
        content: FORENX_CORE_SYSTEM_PROMPT,
      },
      {
        role: 'system',
        content: [
          `Workspace language: ${request.workspaceLanguage}`,
          `Case ID: ${request.caseContext.caseId}`,
          `Case reference: ${request.caseContext.reference}`,
          `Case name: ${request.caseContext.name}`,
          `Case description: ${request.caseContext.description}`,
          `Prompt version: ${request.action.promptVersion}`,
          `Action: ${request.action.id}`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          request.action.taskPrompt,
          '',
          'Return a single JSON object matching the required schema. No prose outside JSON.',
          '',
          evidenceBlocks,
          request.extraContext
            ? `\nAdditional application context (trusted):\n${JSON.stringify(request.extraContext)}`
            : '',
        ].join('\n'),
      },
    ]

    const body = {
      model: 'mistral-small-latest',
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.action.id,
          schema: request.action.jsonSchema,
          strict: false,
        },
      },
      temperature: 0.1,
    }

    let res: Response
    try {
      res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw Object.assign(new Error('Cannot reach AI proxy'), {
        status: 'OFFLINE' as const,
      })
    }

    if (res.status === 503) {
      throw Object.assign(new Error('AI proxy unavailable (no API key)'), {
        status: 'UNAVAILABLE' as const,
      })
    }

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI analyze failed (${res.status}): ${errText.slice(0, 400)}`)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    }
    const content = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content) as Record<string, unknown>
    } catch {
      parsed = { statement: content, epistemicClass: 'UNKNOWN', confidence: 0.2, sourceReferences: [] }
    }

    const validated = request.action.outputSchema.safeParse(parsed)

    return {
      status: 'LIVE',
      model: data.model ?? 'mistral',
      modelVersion: data.model ?? 'unknown',
      promptVersion: request.action.promptVersion || PROMPT_VERSION,
      result: (validated.success ? validated.data : parsed) as Record<string, unknown>,
      raw: data,
    }
  }
}
