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
  EvidenceSection,
  FindingRecord,
  TimelineEventRecord,
} from '@/lib/storage/types'
import { createId } from '@/lib/utils/cn'
import { getAction, type ForensicActionId } from './actions/registry'
import { resolveAiProvider } from './resolveProvider'
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

export async function runForensicAction(
  input: RunAnalysisInput,
): Promise<RunAnalysisResult> {
  const action = getAction(input.actionId)
  if (!action) throw new Error(`Unknown action: ${input.actionId}`)

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
      error: 'Offline — AI actions unavailable',
      resultFindingIds: [],
    })
    await localAuditRepository.append({
      id: createId('audit'),
      caseId: input.caseRecord.id,
      workspaceId: input.caseRecord.workspaceId,
      type: 'AI_ANALYSIS_FAILED',
      createdAt: new Date().toISOString(),
      message: `${action.name} failed: offline`,
      meta: { actionId: action.id, runId },
    })
    return {
      findings: [],
      entities: [],
      timelineEvents: [],
      status: 'OFFLINE',
      error: 'Offline — AI actions unavailable. Evidence remains local.',
    }
  }

  const startAuditId = createId('audit')
  await localAuditRepository.append({
    id: startAuditId,
    caseId: input.caseRecord.id,
    workspaceId: input.caseRecord.workspaceId,
    type: 'AI_ANALYSIS_STARTED',
    createdAt: startedAt,
    message: `${action.name} started (${status})`,
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
      const extraction = await localExtractionRepository.getByEvidence(evidenceId)
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
      workspaceLanguage: input.workspaceLanguage ?? 'en',
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
      statement: String(result.statement ?? `${action.name} completed`),
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
      message: `${action.name} completed (${response.status})`,
      meta: { actionId: action.id, runId, findingId },
    })

    return {
      findings: [finding],
      entities,
      timelineEvents,
      status: response.status,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed'
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
      message: `${action.name} failed: ${message}`,
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
