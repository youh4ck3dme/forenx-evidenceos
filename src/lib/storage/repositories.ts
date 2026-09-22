import type {
  AlertRecord,
  AuditEventRecord,
  CommodityRecord,
  DetectionRuleConfig,
  DetectionRunRecord,
  RelationshipRecord,
  SubjectRecord,
  TransactionRecord,
} from "@/domain/types";
import { getDb } from "./db";

function newestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export const localAuditRepository = {
  listByCase: async (caseId: string) => {
    const rows = await getDb().auditEvents.where("caseId").equals(caseId).toArray();
    return newestFirst(rows);
  },
  append: (event: AuditEventRecord) =>
    getDb()
      .auditEvents.add(event)
      .then(() => undefined),
  countByCase: (caseId: string) => getDb().auditEvents.where("caseId").equals(caseId).count(),
};

export const localSubjectRepository = {
  listByCase: (caseId: string) => getDb().subjects.where("caseId").equals(caseId).toArray(),
  putMany: async (records: SubjectRecord[]) => {
    if (records.length) await getDb().subjects.bulkPut(records);
  },
  clearCase: async (caseId: string) => {
    await getDb().subjects.where("caseId").equals(caseId).delete();
  },
};

export const localTransactionRepository = {
  listByCase: (caseId: string) => getDb().transactions.where("caseId").equals(caseId).toArray(),
  putMany: async (records: TransactionRecord[]) => {
    if (records.length) await getDb().transactions.bulkPut(records);
  },
  clearCase: async (caseId: string) => {
    await getDb().transactions.where("caseId").equals(caseId).delete();
  },
};

export const localCommodityRepository = {
  listByCase: (caseId: string) => getDb().commodities.where("caseId").equals(caseId).toArray(),
  putMany: async (records: CommodityRecord[]) => {
    if (records.length) await getDb().commodities.bulkPut(records);
  },
};

export const localRelationshipRepository = {
  listByCase: (caseId: string) => getDb().relationships.where("caseId").equals(caseId).toArray(),
  putMany: async (records: RelationshipRecord[]) => {
    if (records.length) await getDb().relationships.bulkPut(records);
  },
  clearCase: async (caseId: string) => {
    await getDb().relationships.where("caseId").equals(caseId).delete();
  },
};

export const localAlertRepository = {
  listByCase: async (caseId: string) => {
    const rows = await getDb().alerts.where("caseId").equals(caseId).toArray();
    return newestFirst(rows);
  },
  putMany: async (records: AlertRecord[]) => {
    if (records.length) await getDb().alerts.bulkPut(records);
  },
  update: async (id: string, patch: Partial<AlertRecord>) => {
    await getDb().alerts.update(id, patch);
  },
  clearCase: async (caseId: string) => {
    await getDb().alerts.where("caseId").equals(caseId).delete();
  },
};

export const localDetectionConfigRepository = {
  getByCase: (caseId: string) => getDb().detectionConfigs.where("caseId").equals(caseId).first(),
  put: async (record: DetectionRuleConfig) => {
    await getDb().detectionConfigs.put(record);
  },
};

export const localDetectionRunRepository = {
  listByCase: async (caseId: string) => {
    const rows = await getDb().detectionRuns.where("caseId").equals(caseId).toArray();
    return rows.sort((a, b) =>
      a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0,
    );
  },
  put: async (record: DetectionRunRecord) => {
    await getDb().detectionRuns.put(record);
  },
};

export const localCaseRepository = {
  get: (id: string) => getDb().cases.get(id),
};
