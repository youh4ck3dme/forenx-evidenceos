import Dexie, { type EntityTable } from 'dexie'
import type {
  AiRunRecord,
  AlertRecord,
  AuditEvent,
  CaseRecord,
  CommodityRecord,
  DetectionRuleConfig,
  DetectionRunRecord,
  EntityRecord,
  EvidenceItem,
  ExtractionRecord,
  FindingRecord,
  RelationshipRecord,
  SubjectRecord,
  TimelineEventRecord,
  TransactionRecord,
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
  subjects!: EntityTable<SubjectRecord, 'id'>
  transactions!: EntityTable<TransactionRecord, 'id'>
  commodities!: EntityTable<CommodityRecord, 'id'>
  relationships!: EntityTable<RelationshipRecord, 'id'>
  alerts!: EntityTable<AlertRecord, 'id'>
  detectionConfigs!: EntityTable<DetectionRuleConfig, 'id'>
  detectionRuns!: EntityTable<DetectionRunRecord, 'id'>

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
    this.version(2).stores({
      cases: 'id, workspaceId, updatedAt, status, reference',
      evidence: 'id, caseId, workspaceId, sha256, status, section, importedAt',
      extractions: 'id, caseId, evidenceId',
      findings: 'id, caseId, actionId, createdAt, reviewStatus',
      entities: 'id, caseId, entityType, canonicalValue',
      timelineEvents: 'id, caseId, timestampOriginal, eventType',
      aiRuns: 'id, caseId, actionId, startedAt, status',
      auditEvents: 'id, caseId, type, createdAt',
      subjects: 'id, caseId, workspaceId, name, kind, riskScore',
      transactions: 'id, caseId, workspaceId, bookedAt, amount, fromSubjectId, toSubjectId',
      commodities: 'id, caseId, workspaceId, serialNumber, licenseNumber',
      relationships: 'id, caseId, fromSubjectId, toSubjectId, relationType',
      alerts: 'id, caseId, status, severity, score, createdAt, ruleId',
      detectionConfigs: 'id, caseId',
      detectionRuns: 'id, caseId, startedAt, ruleVersion',
    })
  }
}

export const db = new ForenxDatabase()
