import type { ForensicAction } from './actions/registry'

export type AiConnectionStatus =
  | 'IDLE'
  | 'MOCK'
  | 'LIVE'
  | 'OFFLINE'
  | 'UNAVAILABLE'

export interface AiAnalyzeRequest {
  action: ForensicAction
  caseContext: {
    caseId: string
    name: string
    reference: string
    description: string
  }
  evidenceContext: Array<{
    evidenceId: string
    fileName: string
    mime: string
    sha256: string
    section: string
    extractedText: string
    metadata?: Record<string, unknown>
  }>
  workspaceLanguage: string
  extraContext?: Record<string, unknown>
}

export interface AiAnalyzeResponse {
  status: AiConnectionStatus
  model: string
  modelVersion: string
  promptVersion: string
  result: Record<string, unknown>
  raw?: unknown
}

export interface AiProvider {
  readonly id: string
  getStatus(): Promise<AiConnectionStatus>
  analyze(request: AiAnalyzeRequest): Promise<AiAnalyzeResponse>
}
