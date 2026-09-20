import {
  localAiRunRepository,
  localAuditRepository,
  localEntityRepository,
  localEvidenceRepository,
  localExtractionRepository,
  localFindingRepository,
  localTimelineRepository,
} from '@/lib/storage/repositories'
import type {
  EntityRecord,
  EvidenceItem,
  EvidenceSection,
  ExtractionRecord,
  FindingRecord,
  TimelineEventRecord,
} from '@/lib/storage/types'
import { createId } from '@/lib/utils/cn'
import { loadSettings } from '@/lib/storage/settings'
import { readEvidenceBlob } from '@/lib/storage/opfs'
import { t } from '@/lib/i18n'
import { getAction, type ForensicActionId } from './actions/registry'
import { resolveAiProvider } from './resolveProvider'
import type { AiProvider } from './provider'
import type { CaseRecord } from '@/lib/storage/types'

export interface RunAnalysisInput {
  actionId: ForensicActionId
  caseRecord: CaseRecord
  evidenceIds: string[]
  workspaceLanguage?: string
  extraContext?: Record<string, unknown>
}

export interface RunAnalysisResult {
  findings: FindingRecord[]
  entities: EntityRecord[]
  timelineEvents: TimelineEventRecord[]
  status: string
  error?: string
}

function actionLabel(actionId: string, fallback: string): string {
  const key = `action.${actionId}.name` as Parameters<typeof t>[0]
  const translated = t(key)
  return translated === key ? fallback : translated
}

function mapAiError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return t('ai.error.generic')
  }
  const withKey = error as { i18nKey?: string; message?: string }
  if (withKey.i18nKey) {
    const key = withKey.i18nKey as Parameters<typeof t>[0]
    const msg = t(key)
    if (msg !== key) return msg
  }
  if (withKey.message?.startsWith('ai.error.')) {
    const key = withKey.message.split(':')[0] as Parameters<typeof t>[0]
    const msg = t(key)
    if (msg !== key) return msg
  }
  return withKey.message ?? t('ai.error.generic')
}

function needsOcr(
  evidence: EvidenceItem,
  text: string,
  processor?: string,
): 'image' | 'pdf' | false {
  const name = evidence.originalName
  const mime = evidence.detectedMime || evidence.mime
  const isImage =
    mime.startsWith('image/') || /\.(png|jpe?g|webp|heic|avif)$/i.test(name)
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name)
  const stub =
    processor === 'image-stub' || /No OCR text extracted/i.test(text)
  if (isImage && (stub || text.trim().length < 40)) return 'image'
  if (isPdf && text.trim().length < 40) return 'pdf'
  return false
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function maybeRunOcr(opts: {
  provider: AiProvider
  actionId: ForensicActionId
  evidence: EvidenceItem
  extraction: ExtractionRecord | undefined
  caseRecord: CaseRecord
}): Promise<ExtractionRecord | undefined> {
  if (opts.actionId !== 'ocr_structure') return opts.extraction

  const kind = needsOcr(
    opts.evidence,
    opts.extraction?.text ?? '',
    opts.extraction?.processor,
  )
  if (!kind) return opts.extraction

  const blob = await readEvidenceBlob(opts.evidence.storagePath)
  const base64 = await blobToBase64(blob)
  const ocr = await opts.provider.ocr({
    fileName: opts.evidence.originalName,
    mime: opts.evidence.detectedMime || opts.evidence.mime,
    base64,
    kind,
  })

  const extraction: ExtractionRecord = {
    id: createId('ex'),
    caseId: opts.caseRecord.id,
    evidenceId: opts.evidence.id,
    text: ocr.text,
    pageCount: ocr.pageCount,
    languageHints: [],
    structured: { ocrSource: ocr.status, kind },
    ocrConfidence: ocr.ocrConfidence,
    createdAt: new Date().toISOString(),
    processor: ocr.status === 'LIVE' ? 'mistral-ocr' : 'mock-ocr',
    processorVersion: ocr.modelVersion,
    aiModel: ocr.model,
    source: 'ocr',
    derivedFrom: opts.evidence.id,
    confidence: ocr.ocrConfidence,
  }

  await localExtractionRepository.put(extraction)
  await localEvidenceRepository.update(opts.evidence.id, {
    extractionId: extraction.id,
    status: 'EXTRACTED',
  })

  await localAuditRepository.append({
    id: createId('audit'),
    caseId: opts.caseRecord.id,
    workspaceId: opts.caseRecord.workspaceId,
    type: 'EXTRACTION_CREATED',
    createdAt: new Date().toISOString(),
    message: t('audit.ocrDerived', { name: opts.evidence.originalName }),
    meta: {
      evidenceId: opts.evidence.id,
      extractionId: extraction.id,
      processor: extraction.processor,
      ocrStatus: ocr.status,
    },
  })

  return extraction
}

export async function runForensicAction(
  input: RunAnalysisInput,
): Promise<RunAnalysisResult> {
  const action = getAction(input.actionId)
  if (!action) throw new Error(`Unknown action: ${input.actionId}`)

  const label = actionLabel(action.id, action.name)
  const { provider, status } = await resolveAiProvider()
  const runId = createId('run')
  const startedAt = new Date().toISOString()

  if (status === 'OFFLINE') {
    await localAiRunRepository.put({
      id: runId,
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      actionId: action.id,
      evidenceIds: input.evidenceIds,
      status: 'OFFLINE',
      promptVersion: action.promptVersion,
      model: 'none',
      modelVersion: 'none',
      startedAt,
      completedAt: new Date().toISOString(),
      error: t('ai.error.offline'),
      resultFindingIds: [],
    })
    await localAuditRepository.append({
      id: createId('audit'),
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      type: 'AI_ANALYSIS_FAILED',
      createdAt: new Date().toISOString(),
      message: t('audit.aiFailed', { action: label, reason: t('ai.error.offline') }),
      meta: { actionId: action.id, runId },
    })
    return {
      findings: [],
      entities: [],
      timelineEvents: [],
      status: 'OFFLINE',
      error: t('ai.error.offlineLocal'),
    }
  }

  const startAuditId = createId('audit')
  await localAuditRepository.append({
    id: startAuditId,
    caseId: input.caseRecord.id,
    workspaceId: input.caseRecord.workspaceId,
    type: 'AI_ANALYSIS_STARTED',
    createdAt: startedAt,
    message: t('audit.aiStarted', { action: label, status }),
    meta: { actionId: action.id, runId, evidenceIds: input.evidenceIds },
  })

  await localAiRunRepository.put({
    id: runId,
    caseId: input.caseRecord.id,
    workspaceId: input.caseRecord.workspaceId,
    actionId: action.id,
    evidenceIds: input.evidenceIds,
    status: 'STARTED',
    promptVersion: action.promptVersion,
    model: provider.id,
    modelVersion: 'pending',
    startedAt,
    resultFindingIds: [],
    auditEventId: startAuditId,
  })

  try {
    const evidenceContext = []
    for (const evidenceId of input.evidenceIds) {
      const evidence = await localEvidenceRepository.get(evidenceId)
      if (!evidence) continue
      let extraction = await localExtractionRepository.getByEvidence(evidenceId)
      extraction = await maybeRunOcr({
        provider,
        actionId: action.id,
        evidence,
        extraction,
        caseRecord: input.caseRecord,
      })
      evidenceContext.push({
        evidenceId: evidence.id,
        fileName: evidence.originalName,
        mime: evidence.detectedMime,
        sha256: evidence.sha256,
        section: evidence.sectionOverride ?? evidence.section,
        extractedText: extraction?.text ?? '',
        metadata: {
          byteSize: evidence.byteSize,
          importedAt: evidence.importedAt,
          status: evidence.status,
          processor: extraction?.processor,
          ocrConfidence: extraction?.ocrConfidence,
        },
      })
    }

    const response = await provider.analyze({
      action,
      caseContext: {
        caseId: input.caseRecord.id,
        name: input.caseRecord.name,
        reference: input.caseRecord.reference,
        description: input.caseRecord.description,
      },
      evidenceContext,
      workspaceLanguage:
        input.workspaceLanguage ?? loadSettings().workspaceLanguage ?? 'sk',
      extraContext: input.extraContext,
    })

    const result = response.result
    const findingId = createId('find')
    const finding: FindingRecord = {
      id: findingId,
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      evidenceIds: input.evidenceIds,
      actionId: action.id,
      promptVersion: response.promptVersion,
      model: response.model,
      modelVersion: response.modelVersion,
      createdAt: new Date().toISOString(),
      statement: String(result.statement ?? t('ai.completedGeneric', { action: label })),
      epistemicClass:
        (result.epistemicClass as FindingRecord['epistemicClass']) ?? 'INFERRED',
      confidence: Number(result.confidence ?? 0.5),
      sourceReferences: Array.isArray(result.sourceReferences)
        ? (result.sourceReferences as FindingRecord['sourceReferences'])
        : [],
      reviewStatus: 'PENDING',
      payload: result,
      auditEventId: startAuditId,
    }

    await localFindingRepository.put(finding)

    const entities: EntityRecord[] = []
    if (Array.isArray(result.entities)) {
      for (const entity of result.entities as Array<Record<string, unknown>>) {
        entities.push({
          id: createId('ent'),
          caseId: input.caseRecord.id,
          workspaceId: input.caseRecord.workspaceId,
          entityType: String(entity.entityType ?? 'OTHER'),
          canonicalValue: String(entity.canonicalValue ?? ''),
          originalRepresentation: String(
            entity.originalRepresentation ?? entity.canonicalValue ?? '',
          ),
          aliases: Array.isArray(entity.aliases)
            ? (entity.aliases as string[])
            : [],
          evidenceIds: input.evidenceIds,
          sourceReferences: Array.isArray(entity.sourceReferences)
            ? (entity.sourceReferences as EntityRecord['sourceReferences'])
            : [],
          confidence: Number(entity.confidence ?? 0.5),
          createdAt: new Date().toISOString(),
          promptVersion: response.promptVersion,
          modelVersion: response.modelVersion,
        })
      }
      if (entities.length) await localEntityRepository.putMany(entities)
    }

    const timelineEvents: TimelineEventRecord[] = []
    if (Array.isArray(result.events)) {
      for (const event of result.events as Array<Record<string, unknown>>) {
        timelineEvents.push({
          id: createId('tl'),
          caseId: input.caseRecord.id,
          workspaceId: input.caseRecord.workspaceId,
          eventId: String(event.eventId ?? createId('event')),
          timestampOriginal: String(event.timestampOriginal ?? 'UNKNOWN'),
          timestampNormalized: event.timestampNormalized
            ? String(event.timestampNormalized)
            : undefined,
          timezone: event.timezone ? String(event.timezone) : undefined,
          timePrecision: String(event.timePrecision ?? 'UNKNOWN'),
          eventType: String(event.eventType ?? 'OTHER'),
          actors: Array.isArray(event.actors) ? (event.actors as string[]) : [],
          action: String(event.action ?? ''),
          objects: Array.isArray(event.objects) ? (event.objects as string[]) : [],
          location: event.location ? String(event.location) : undefined,
          sourceReferences: Array.isArray(event.sourceReferences)
            ? (event.sourceReferences as TimelineEventRecord['sourceReferences'])
            : [],
          confidence: Number(event.confidence ?? 0.5),
          createdAt: new Date().toISOString(),
          promptVersion: response.promptVersion,
          modelVersion: response.modelVersion,
        })
      }
      if (timelineEvents.length) {
        await localTimelineRepository.putMany(timelineEvents)
      }
    }

    if (action.id === 'auto_triage' && typeof result.workspaceSection === 'string') {
      const section = result.workspaceSection as EvidenceSection
      for (const evidenceId of input.evidenceIds) {
        await localEvidenceRepository.update(evidenceId, {
          section,
          status: 'ANALYZED',
        })
      }
    } else {
      for (const evidenceId of input.evidenceIds) {
        await localEvidenceRepository.update(evidenceId, { status: 'ANALYZED' })
      }
    }

    await localAiRunRepository.put({
      id: runId,
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      actionId: action.id,
      evidenceIds: input.evidenceIds,
      status: 'COMPLETED',
      promptVersion: response.promptVersion,
      model: response.model,
      modelVersion: response.modelVersion,
      startedAt,
      completedAt: new Date().toISOString(),
      resultFindingIds: [findingId],
      auditEventId: startAuditId,
    })

    await localAuditRepository.append({
      id: createId('audit'),
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      type: 'AI_ANALYSIS_COMPLETED',
      createdAt: new Date().toISOString(),
      message: t('audit.aiCompleted', { action: label, status: response.status }),
      meta: { actionId: action.id, runId, findingId },
    })

    return {
      findings: [finding],
      entities,
      timelineEvents,
      status: response.status,
    }
  } catch (error) {
    const message = mapAiError(error)
    const failStatus =
      error && typeof error === 'object' && 'status' in error
        ? String((error as { status: string }).status)
        : 'FAILED'

    await localAiRunRepository.put({
      id: runId,
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      actionId: action.id,
      evidenceIds: input.evidenceIds,
      status: failStatus === 'OFFLINE' ? 'OFFLINE' : 'FAILED',
      promptVersion: action.promptVersion,
      model: provider.id,
      modelVersion: 'error',
      startedAt,
      completedAt: new Date().toISOString(),
      error: message,
      resultFindingIds: [],
      auditEventId: startAuditId,
    })

    await localAuditRepository.append({
      id: createId('audit'),
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      type: 'AI_ANALYSIS_FAILED',
      createdAt: new Date().toISOString(),
      message: t('audit.aiFailed', { action: label, reason: message }),
      meta: { actionId: action.id, runId },
    })

    return {
      findings: [],
      entities: [],
      timelineEvents: [],
      status: failStatus,
      error: message,
    }
  }
}
