export const CLASSIFICATIONS = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const CASE_STATUSES = ["OPEN", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const EVIDENCE_STATUSES = [
  "IMPORTED",
  "HASHED",
  "EXTRACTED",
  "ANALYZED",
  "QUARANTINED",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_SECTIONS = [
  "IDENTITY",
  "COMMUNICATION",
  "FINANCIAL",
  "CONTRACT",
  "TECHNICAL",
  "MEDIA",
  "TIMELINE",
  "LEGAL_DOCUMENT",
  "ADMINISTRATIVE",
  "LOCATION",
  "OTHER",
] as const;
export type EvidenceSection = (typeof EVIDENCE_SECTIONS)[number];

export const EPISTEMIC_CLASSES = [
  "OBSERVED",
  "DERIVED",
  "INFERRED",
  "HYPOTHESIS",
  "UNKNOWN",
] as const;
export type EpistemicClass = (typeof EPISTEMIC_CLASSES)[number];

export const REVIEW_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "NEEDS_REVIEW",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const AUDIT_TYPES = [
  "CASE_CREATED",
  "EVIDENCE_IMPORTED",
  "EVIDENCE_HASHED",
  "EVIDENCE_SELECTED",
  "EXTRACTION_CREATED",
  "AI_ANALYSIS_STARTED",
  "AI_ANALYSIS_COMPLETED",
  "AI_ANALYSIS_FAILED",
  "FINDING_REVIEWED",
  "EXPORT_CREATED",
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export const WORKSPACE_ID = "local-workspace";
export const SCHEMA_VERSION = 1;
export const PROMPT_VERSION = "1.0.0";

export type DetectedKind =
  | "pdf"
  | "image"
  | "docx"
  | "rtf"
  | "markdown"
  | "text"
  | "csv"
  | "json"
  | "xml"
  | "html"
  | "unknown"
  | "executable";

export type IngestLane = "NATIVE" | "NORMALIZE" | "QUARANTINE";

export interface CaseRecord {
  id: string;
  workspaceId: string;
  tenantId?: string;
  createdBy?: string;
  name: string;
  reference: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: CaseStatus;
  classification: Classification;
  tags: string[];
  retentionPolicy?: string;
}

export interface EvidenceRecord {
  id: string;
  caseId: string;
  originalName: string;
  extension: string;
  mime: string;
  detectedMime: string;
  detectedKind: DetectedKind;
  byteSize: number;
  sha256: string;
  importedAt: string;
  originalLastModified: string | null;
  storagePath: string;
  status: EvidenceStatus;
  section: EvidenceSection;
  sectionSource: "HUMAN" | "AI" | "DEFAULT";
  ingestLane: IngestLane;
  quarantineReason?: string;
  duplicateOf?: string;
  extractionId?: string;
  previewKind: "pdf" | "image" | "text" | "markdown" | "metadata";
}

export interface ExtractionRecord {
  id: string;
  caseId: string;
  evidenceId: string;
  createdAt: string;
  processor: string;
  processorVersion: string;
  text: string;
  pageCount?: number;
  languageHint?: string;
  wordCount: number;
  truncated: boolean;
  metadata: Record<string, string | number | boolean | null>;
  source: "ORIGINAL";
  derivedFrom: string;
}

export interface SourceReference {
  evidenceId: string;
  fileName: string;
  page?: number;
  section?: string;
  excerpt?: string;
}

export interface FindingRecord {
  id: string;
  caseId: string;
  evidenceIds: string[];
  actionId: string;
  promptVersion: string;
  model: string;
  createdAt: string;
  statement: string;
  epistemicClass: EpistemicClass;
  confidence: number;
  sourceReferences: SourceReference[];
  reviewStatus: ReviewStatus;
  runId: string;
}

export interface EntityRecord {
  id: string;
  caseId: string;
  entityType: string;
  canonicalValue: string;
  originalRepresentation: string;
  aliases: string[];
  evidenceIds: string[];
  sourceReferences: SourceReference[];
  confidence: number;
  createdAt: string;
  runId: string;
}

export interface TimelineEventRecord {
  id: string;
  caseId: string;
  eventId: string;
  timestampOriginal: string;
  timestampNormalized: string | null;
  timezone: string | null;
  timePrecision: string;
  eventType: string;
  actors: string[];
  action: string;
  objects: string[];
  location: string | null;
  sourceReferences: SourceReference[];
  confidence: number;
  createdAt: string;
  runId: string;
}

export type AiRunStatus = "STARTED" | "COMPLETED" | "FAILED" | "BLOCKED";

export interface AiRunRecord {
  id: string;
  caseId: string;
  actionId: string;
  evidenceIds: string[];
  promptVersion: string;
  model: string | null;
  status: AiRunStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
  summary?: string;
  rawJson?: string;
}

export interface AuditEventRecord {
  id: string;
  caseId: string | null;
  type: AuditType;
  createdAt: string;
  message: string;
  payload?: Record<string, string | number | boolean | null>;
}

export type AiAvailability = "LIVE" | "UNAVAILABLE" | "OFFLINE" | "RUNNING";
