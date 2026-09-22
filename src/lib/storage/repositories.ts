import { db } from './db'
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

export interface CaseRepository {
  list(): Promise<CaseRecord[]>
  get(id: string): Promise<CaseRecord | undefined>
  put(record: CaseRecord): Promise<void>
  remove(id: string): Promise<void>
}

export interface EvidenceRepository {
  listByCase(caseId: string): Promise<EvidenceItem[]>
  get(id: string): Promise<EvidenceItem | undefined>
  put(record: EvidenceItem): Promise<void>
  update(id: string, patch: Partial<EvidenceItem>): Promise<void>
}

export interface ExtractionRepository {
  getByEvidence(evidenceId: string): Promise<ExtractionRecord | undefined>
  put(record: ExtractionRecord): Promise<void>
}

export interface FindingRepository {
  listByCase(caseId: string): Promise<FindingRecord[]>
  put(record: FindingRecord): Promise<void>
  putMany(records: FindingRecord[]): Promise<void>
  update(id: string, patch: Partial<FindingRecord>): Promise<void>
}

export interface EntityRepository {
  listByCase(caseId: string): Promise<EntityRecord[]>
  putMany(records: EntityRecord[]): Promise<void>
}

export interface TimelineRepository {
  listByCase(caseId: string): Promise<TimelineEventRecord[]>
  putMany(records: TimelineEventRecord[]): Promise<void>
}

export interface AiRunRepository {
  listByCase(caseId: string): Promise<AiRunRecord[]>
  put(record: AiRunRecord): Promise<void>
}

export interface AuditRepository {
  listByCase(caseId: string): Promise<AuditEvent[]>
  append(event: AuditEvent): Promise<void>
  countByCase(caseId: string): Promise<number>
}

export const localCaseRepository: CaseRepository = {
  list: () => db.cases.orderBy('updatedAt').reverse().toArray(),
  get: (id) => db.cases.get(id),
  put: (record) => db.cases.put(record).then(() => undefined),
  remove: (id) => db.cases.delete(id),
}

export const localEvidenceRepository: EvidenceRepository = {
  listByCase: (caseId) =>
    db.evidence.where('caseId').equals(caseId).reverse().sortBy('importedAt'),
  get: (id) => db.evidence.get(id),
  put: (record) => db.evidence.put(record).then(() => undefined),
  update: async (id, patch) => {
    await db.evidence.update(id, patch)
  },
}

export const localExtractionRepository: ExtractionRepository = {
  getByEvidence: (evidenceId) =>
    db.extractions.where('evidenceId').equals(evidenceId).first(),
  put: (record) => db.extractions.put(record).then(() => undefined),
}

export const localFindingRepository: FindingRepository = {
  listByCase: (caseId) =>
    db.findings.where('caseId').equals(caseId).reverse().sortBy('createdAt'),
  put: (record) => db.findings.put(record).then(() => undefined),
  putMany: async (records) => {
    await db.findings.bulkPut(records)
  },
  update: async (id, patch) => {
    await db.findings.update(id, patch)
  },
}

export const localEntityRepository: EntityRepository = {
  listByCase: (caseId) => db.entities.where('caseId').equals(caseId).toArray(),
  putMany: async (records) => {
    await db.entities.bulkPut(records)
  },
}

export const localTimelineRepository: TimelineRepository = {
  listByCase: (caseId) =>
    db.timelineEvents.where('caseId').equals(caseId).toArray(),
  putMany: async (records) => {
    await db.timelineEvents.bulkPut(records)
  },
}

export const localAiRunRepository: AiRunRepository = {
  listByCase: (caseId) =>
    db.aiRuns.where('caseId').equals(caseId).reverse().sortBy('startedAt'),
  put: (record) => db.aiRuns.put(record).then(() => undefined),
}

export const localAuditRepository: AuditRepository = {
  listByCase: (caseId) =>
    db.auditEvents.where('caseId').equals(caseId).reverse().sortBy('createdAt'),
  append: (event) => db.auditEvents.add(event).then(() => undefined),
  countByCase: (caseId) => db.auditEvents.where('caseId').equals(caseId).count(),
}

export const localSubjectRepository = {
  listByCase: (caseId: string) =>
    db.subjects.where('caseId').equals(caseId).toArray(),
  putMany: async (records: SubjectRecord[]) => {
    await db.subjects.bulkPut(records)
  },
  clearCase: async (caseId: string) => {
    await db.subjects.where('caseId').equals(caseId).delete()
  },
}

export const localTransactionRepository = {
  listByCase: (caseId: string) =>
    db.transactions.where('caseId').equals(caseId).toArray(),
  putMany: async (records: TransactionRecord[]) => {
    await db.transactions.bulkPut(records)
  },
  clearCase: async (caseId: string) => {
    await db.transactions.where('caseId').equals(caseId).delete()
  },
}

export const localCommodityRepository = {
  listByCase: (caseId: string) =>
    db.commodities.where('caseId').equals(caseId).toArray(),
  putMany: async (records: CommodityRecord[]) => {
    await db.commodities.bulkPut(records)
  },
}

export const localRelationshipRepository = {
  listByCase: (caseId: string) =>
    db.relationships.where('caseId').equals(caseId).toArray(),
  putMany: async (records: RelationshipRecord[]) => {
    await db.relationships.bulkPut(records)
  },
  clearCase: async (caseId: string) => {
    await db.relationships.where('caseId').equals(caseId).delete()
  },
}

export const localAlertRepository = {
  listByCase: (caseId: string) =>
    db.alerts.where('caseId').equals(caseId).reverse().sortBy('createdAt'),
  putMany: async (records: AlertRecord[]) => {
    await db.alerts.bulkPut(records)
  },
  update: async (id: string, patch: Partial<AlertRecord>) => {
    await db.alerts.update(id, patch)
  },
  clearCase: async (caseId: string) => {
    await db.alerts.where('caseId').equals(caseId).delete()
  },
}

export const localDetectionConfigRepository = {
  getByCase: async (caseId: string) =>
    db.detectionConfigs.where('caseId').equals(caseId).first(),
  put: async (record: DetectionRuleConfig) => {
    await db.detectionConfigs.put(record)
  },
}

export const localDetectionRunRepository = {
  listByCase: (caseId: string) =>
    db.detectionRuns.where('caseId').equals(caseId).reverse().sortBy('startedAt'),
  put: async (record: DetectionRunRecord) => {
    await db.detectionRuns.put(record)
  },
}
