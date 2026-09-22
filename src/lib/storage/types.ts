export type Classification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED'

export type CaseStatus = 'OPEN' | 'ACTIVE' | 'ARCHIVED' | 'CLOSED'

export type EvidenceStatus =
  | 'IMPORTED'
  | 'HASHED'
  | 'EXTRACTED'
  | 'ANALYZED'
  | 'QUARANTINED'

export type EvidenceSection =
  | 'IDENTITY'
  | 'COMMUNICATION'
  | 'FINANCIAL'
  | 'CONTRACT'
  | 'TECHNICAL'
  | 'MEDIA'
  | 'TIMELINE'
  | 'LEGAL_DOCUMENT'
  | 'ADMINISTRATIVE'
  | 'LOCATION'
  | 'OTHER'

export type EpistemicClass =
  | 'OBSERVED'
  | 'DERIVED'
  | 'INFERRED'
  | 'HYPOTHESIS'
  | 'UNKNOWN'

export type ReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW'

export type IngestRoute = 'NATIVE' | 'NORMALIZE' | 'QUARANTINE'

export interface ProvenanceFields {
  source?: string
  derivedFrom?: string
  createdAt: string
  processor: string
  processorVersion: string
  aiModel?: string
  promptVersion?: string
  confidence?: number
}

export interface SourceReference {
  evidenceId: string
  fileName?: string
  page?: number
  section?: string
  paragraph?: number
  blockId?: string
  timestamp?: string
  sourceRange?: string
  note?: string
}

export interface CaseRecord {
  id: string
  workspaceId: string
  tenantId?: string
  name: string
  reference: string
  description: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  status: CaseStatus
  classification: Classification
  tags: string[]
  retentionPolicy?: string
}

export interface EvidenceItem {
  id: string
  caseId: string
  workspaceId: string
  tenantId?: string
  originalName: string
  extension: string
  mime: string
  detectedMime: string
  byteSize: number
  sha256: string
  importedAt: string
  originalLastModified: string | null
  /** Immutable original OPFS path — never mutated. */
  storagePath: string
  /** Optional derived/normalized preview path. */
  normalizedPath?: string
  status: EvidenceStatus
  extractionId?: string
  section: EvidenceSection
  sectionOverride?: EvidenceSection
  ingestRoute: IngestRoute
  quarantineReason?: string
  tags: string[]
  classification: Classification
  createdBy?: string
}

export interface ExtractionRecord extends ProvenanceFields {
  id: string
  caseId: string
  evidenceId: string
  text: string
  pageCount?: number
  languageHints: string[]
  structured?: Record<string, unknown>
  ocrConfidence?: number
}

export interface FindingRecord {
  id: string
  caseId: string
  workspaceId: string
  evidenceIds: string[]
  actionId: string
  promptVersion: string
  model: string
  modelVersion: string
  createdAt: string
  statement: string
  epistemicClass: EpistemicClass
  confidence: number
  sourceReferences: SourceReference[]
  reviewStatus: ReviewStatus
  payload: Record<string, unknown>
  auditEventId?: string
  createdBy?: string
  tenantId?: string
}

export interface EntityRecord {
  id: string
  caseId: string
  workspaceId: string
  entityType: string
  canonicalValue: string
  originalRepresentation: string
  aliases: string[]
  evidenceIds: string[]
  sourceReferences: SourceReference[]
  confidence: number
  createdAt: string
  promptVersion?: string
  modelVersion?: string
}

export interface TimelineEventRecord {
  id: string
  caseId: string
  workspaceId: string
  eventId: string
  timestampOriginal: string
  timestampNormalized?: string
  timezone?: string
  timePrecision: string
  eventType: string
  actors: string[]
  action: string
  objects: string[]
  location?: string
  sourceReferences: SourceReference[]
  confidence: number
  createdAt: string
  promptVersion?: string
  modelVersion?: string
}

export interface AiRunRecord {
  id: string
  caseId: string
  workspaceId: string
  actionId: string
  evidenceIds: string[]
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'OFFLINE'
  promptVersion: string
  model: string
  modelVersion: string
  startedAt: string
  completedAt?: string
  error?: string
  resultFindingIds: string[]
  auditEventId?: string
}

export type AuditEventType =
  | 'CASE_CREATED'
  | 'EVIDENCE_IMPORTED'
  | 'EVIDENCE_HASHED'
  | 'EVIDENCE_SELECTED'
  | 'EXTRACTION_CREATED'
  | 'AI_ANALYSIS_STARTED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'AI_ANALYSIS_FAILED'
  | 'FINDING_REVIEWED'
  | 'EXPORT_CREATED'
  | 'MALTE_IMPORT'
  | 'MALTE_DETECTION_RUN'
  | 'MALTE_ALERT_REVIEWED'
  | 'MALTE_REPORT_EXPORTED'
  | 'MALTE_WEIGHTS_UPDATED'

export interface AuditEvent {
  id: string
  caseId: string
  workspaceId: string
  type: AuditEventType
  createdAt: string
  message: string
  meta?: Record<string, unknown>
  createdBy?: string
  tenantId?: string
  /** SHA-256 of previous audit event id+type+createdAt+message (chain integrity). */
  prevHash?: string
  /** SHA-256 of this event's canonical payload including prevHash. */
  eventHash?: string
}

/** Malte — financial investigation domain */

export type SubjectKind =
  | 'PERSON'
  | 'COMPANY'
  | 'SHELL_SUSPECT'
  | 'ACCOUNT'
  | 'OTHER'

export interface SubjectRecord {
  id: string
  caseId: string
  workspaceId: string
  kind: SubjectKind
  name: string
  ico?: string
  country?: string
  accountIban?: string
  riskScore: number
  flags: string[]
  createdAt: string
  sourceEvidenceId?: string
}

export interface TransactionRecord {
  id: string
  caseId: string
  workspaceId: string
  bookedAt: string
  amount: number
  currency: string
  fromSubjectId?: string
  toSubjectId?: string
  fromLabel: string
  toLabel: string
  description: string
  reference?: string
  countryFrom?: string
  countryTo?: string
  commodityCode?: string
  sourceEvidenceId?: string
  sourceRow?: number
  riskScore: number
  createdAt: string
}

export interface CommodityRecord {
  id: string
  caseId: string
  workspaceId: string
  name: string
  serialNumber?: string
  licenseNumber?: string
  category?: string
  subjectId?: string
  createdAt: string
}

export interface RelationshipRecord {
  id: string
  caseId: string
  workspaceId: string
  fromSubjectId: string
  toSubjectId: string
  relationType: string
  weight: number
  evidenceIds: string[]
  createdAt: string
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertStatus = 'NEW' | 'REVIEWED' | 'FALSE_POSITIVE' | 'ESCALATED'

export interface ScoreFactor {
  code: string
  label: string
  weight: number
  contribution: number
  evidenceRef?: string
  sourceRow?: number
}

export interface AlertRecord {
  id: string
  caseId: string
  workspaceId: string
  ruleId: string
  ruleVersion: string
  title: string
  description: string
  severity: AlertSeverity
  status: AlertStatus
  score: number
  factors: ScoreFactor[]
  subjectIds: string[]
  transactionIds: string[]
  assignedTo?: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNote?: string
  createdAt: string
  detectionRunId: string
}

export interface DetectionWeights {
  shellCompany: number
  transactionAnomaly: number
  licenseSerial: number
  networkChain: number
  crossBorder: number
  highValueBurst: number
}

export interface DetectionRuleConfig {
  id: string
  caseId: string
  workspaceId: string
  ruleVersion: string
  weights: DetectionWeights
  thresholds: {
    alertMinScore: number
    highValueAmount: number
    shellNameHints: string[]
  }
  updatedAt: string
}

export interface DetectionRunRecord {
  id: string
  caseId: string
  workspaceId: string
  ruleVersion: string
  startedAt: string
  completedAt: string
  alertCount: number
  subjectCount: number
  transactionCount: number
  weightsSnapshot: DetectionWeights
  inputHash: string
}

export interface WorkspaceSettings {
  schemaVersion: number
  theme: 'dark' | 'light'
  activeCaseId: string | null
  workspaceId: string
  /** UI + AI workspace language: sk | en */
  workspaceLanguage: string
  aiMode: 'auto' | 'mock' | 'http'
  promptOverrides: Record<string, string>
  enteredSandbox: boolean
}
