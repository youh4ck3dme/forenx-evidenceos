import Dexie, { type Table } from "dexie";
import type {
  AiRunRecord,
  AlertRecord,
  AuditEventRecord,
  CaseRecord,
  CommodityRecord,
  DetectionRuleConfig,
  DetectionRunRecord,
  EntityRecord,
  EvidenceRecord,
  ExtractionRecord,
  FindingRecord,
  RelationshipRecord,
  SubjectRecord,
  TimelineEventRecord,
  TransactionRecord,
} from "@/domain/types";

export interface BlobRecord {
  id: string;
  caseId: string;
  evidenceId: string;
  kind: "original" | "normalized" | "preview" | "export";
  blob: Blob;
}

class ForenxDB extends Dexie {
  cases!: Table<CaseRecord, string>;
  evidence!: Table<EvidenceRecord, string>;
  extractions!: Table<ExtractionRecord, string>;
  findings!: Table<FindingRecord, string>;
  entities!: Table<EntityRecord, string>;
  timelineEvents!: Table<TimelineEventRecord, string>;
  aiRuns!: Table<AiRunRecord, string>;
  auditEvents!: Table<AuditEventRecord, string>;
  blobs!: Table<BlobRecord, string>;
  subjects!: Table<SubjectRecord, string>;
  transactions!: Table<TransactionRecord, string>;
  commodities!: Table<CommodityRecord, string>;
  relationships!: Table<RelationshipRecord, string>;
  alerts!: Table<AlertRecord, string>;
  detectionConfigs!: Table<DetectionRuleConfig, string>;
  detectionRuns!: Table<DetectionRunRecord, string>;

  constructor() {
    super("forenx-evidence-os");
    const core = {
      cases: "id, workspaceId, updatedAt, reference",
      evidence: "id, caseId, sha256, status, importedAt, section",
      extractions: "id, evidenceId, caseId",
      findings: "id, caseId, actionId, createdAt, runId",
      entities: "id, caseId, entityType, canonicalValue, runId",
      timelineEvents: "id, caseId, timestampNormalized, runId",
      aiRuns: "id, caseId, actionId, createdAt, status",
      auditEvents: "id, caseId, type, createdAt",
      blobs: "id, caseId, evidenceId, kind",
    };
    this.version(1).stores(core);
    this.version(2).stores({
      ...core,
      subjects: "id, caseId, workspaceId, name, kind, riskScore",
      transactions: "id, caseId, workspaceId, bookedAt, amount, fromSubjectId, toSubjectId",
      commodities: "id, caseId, workspaceId, serialNumber, licenseNumber",
      relationships: "id, caseId, fromSubjectId, toSubjectId, relationType",
      alerts: "id, caseId, status, severity, score, createdAt, ruleId",
      detectionConfigs: "id, caseId",
      detectionRuns: "id, caseId, startedAt, ruleVersion",
    });
  }
}

let instance: ForenxDB | null = null;

export function getDb(): ForenxDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!instance) instance = new ForenxDB();
  return instance;
}

export function isBrowserStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
