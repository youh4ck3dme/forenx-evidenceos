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
}

export interface WorkspaceSettings {
  schemaVersion: number
  theme: 'dark'
  activeCaseId: string | null
  workspaceId: string
  /** UI + AI workspace language: sk | en */
  workspaceLanguage: string
  aiMode: 'auto' | 'mock' | 'http'
  promptOverrides: Record<string, string>
  enteredSandbox: boolean
}
