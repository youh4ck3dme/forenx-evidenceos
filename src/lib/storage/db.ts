import Dexie, { type EntityTable } from 'dexie'
import type {
  AiRunRecord,
  AuditEvent,
  CaseRecord,
  EntityRecord,
  EvidenceItem,
  ExtractionRecord,
  FindingRecord,
  TimelineEventRecord,
} from './types'

export class ForenxDatabase extends Dexie {
  cases!: EntityTable<CaseRecord, 'id'>
  evidence!: EntityTable<EvidenceItem, 'id'>
  extractions!: EntityTable<ExtractionRecord, 'id'>
  findings!: EntityTable<FindingRecord, 'id'>
  entities!: EntityTable<EntityRecord, 'id'>
  timelineEvents!: EntityTable<TimelineEventRecord, 'id'>
  aiRuns!: EntityTable<AiRunRecord, 'id'>
  auditEvents!: EntityTable<AuditEvent, 'id'>

  constructor() {
    super('forenx-evidence-os')
    this.version(1).stores({
      cases: 'id, workspaceId, updatedAt, status, reference',
      evidence: 'id, caseId, workspaceId, sha256, status, section, importedAt',
      extractions: 'id, caseId, evidenceId',
      findings: 'id, caseId, actionId, createdAt, reviewStatus',
      entities: 'id, caseId, entityType, canonicalValue',
      timelineEvents: 'id, caseId, timestampOriginal, eventType',
      aiRuns: 'id, caseId, actionId, startedAt, status',
      auditEvents: 'id, caseId, type, createdAt',
    })
  }
}

export const db = new ForenxDatabase()
