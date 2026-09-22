import { createId } from "@/lib/ids";
import { sha256Hex } from "@/lib/hash/sha256";
import {
  localAlertRepository,
  localDetectionConfigRepository,
  localDetectionRunRepository,
  localRelationshipRepository,
  localSubjectRepository,
  localTransactionRepository,
} from "@/lib/storage/repositories";
import { appendAuditChained } from "@/lib/storage/auditChain";
import type {
  AlertRecord,
  AlertSeverity,
  DetectionRuleConfig,
  DetectionWeights,
  RelationshipRecord,
  ScoreFactor,
  SubjectRecord,
  TransactionRecord,
} from "@/domain/types";
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, MALTE_RULE_VERSION } from "./defaults";

function severityFor(score: number): AlertSeverity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function ensureDetectionConfig(
  caseId: string,
  workspaceId: string,
): Promise<DetectionRuleConfig> {
  const existing = await localDetectionConfigRepository.getByCase(caseId);
  if (existing) return existing;
  const config: DetectionRuleConfig = {
    id: createId("dcfg"),
    caseId,
    workspaceId,
    ruleVersion: MALTE_RULE_VERSION,
    weights: { ...DEFAULT_WEIGHTS },
    thresholds: {
      alertMinScore: DEFAULT_THRESHOLDS.alertMinScore,
      highValueAmount: DEFAULT_THRESHOLDS.highValueAmount,
      shellNameHints: [...DEFAULT_THRESHOLDS.shellNameHints],
    },
    updatedAt: new Date().toISOString(),
  };
  await localDetectionConfigRepository.put(config);
  return config;
}

export async function updateDetectionWeights(
  caseId: string,
  workspaceId: string,
  weights: DetectionWeights,
): Promise<DetectionRuleConfig> {
  const config = await ensureDetectionConfig(caseId, workspaceId);
  const next: DetectionRuleConfig = {
    ...config,
    weights,
    ruleVersion: MALTE_RULE_VERSION,
    updatedAt: new Date().toISOString(),
  };
  await localDetectionConfigRepository.put(next);
  await appendAuditChained({
    id: createId("audit"),
    caseId,
    workspaceId,
    type: "MALTE_WEIGHTS_UPDATED",
    createdAt: new Date().toISOString(),
    message: `Detection weights updated (${MALTE_RULE_VERSION})`,
    meta: { weights, ruleVersion: MALTE_RULE_VERSION },
  });
  return next;
}

function findOrCreateSubject(
  map: Map<string, SubjectRecord>,
  label: string,
  caseId: string,
  workspaceId: string,
  extras?: Partial<SubjectRecord>,
): SubjectRecord {
  const key = label.trim().toLowerCase();
  const hit = map.get(key);
  if (hit) return hit;
  const subject: SubjectRecord = {
    id: createId("subj"),
    caseId,
    workspaceId,
    kind: "COMPANY",
    name: label.trim() || "Unknown",
    riskScore: 0,
    flags: [],
    createdAt: new Date().toISOString(),
    ...extras,
  };
  map.set(key, subject);
  return subject;
}

export interface DetectionResult {
  runId: string;
  alerts: AlertRecord[];
  subjects: SubjectRecord[];
  relationships: RelationshipRecord[];
}

/** Deterministic Malte detection — rules only, no LLM. */
export async function runMalteDetection(
  caseId: string,
  workspaceId: string,
): Promise<DetectionResult> {
  const config = await ensureDetectionConfig(caseId, workspaceId);
  const transactions = await localTransactionRepository.listByCase(caseId);
  let subjects = await localSubjectRepository.listByCase(caseId);

  const subjectMap = new Map<string, SubjectRecord>();
  for (const s of subjects) subjectMap.set(s.name.trim().toLowerCase(), s);

  // Link transaction counterparties to subjects
  for (const tx of transactions) {
    if (!tx.fromSubjectId) {
      const s = findOrCreateSubject(subjectMap, tx.fromLabel, caseId, workspaceId);
      tx.fromSubjectId = s.id;
    }
    if (!tx.toSubjectId) {
      const s = findOrCreateSubject(subjectMap, tx.toLabel, caseId, workspaceId);
      tx.toSubjectId = s.id;
    }
  }
  subjects = [...subjectMap.values()];
  await localSubjectRepository.putMany(subjects);
  await localTransactionRepository.putMany(transactions);

  const w = config.weights;
  const hints = config.thresholds.shellNameHints.map((h) => h.toLowerCase());
  const alerts: AlertRecord[] = [];
  const relationships: RelationshipRecord[] = [];
  const startedAt = new Date().toISOString();
  const runId = createId("drun");

  // Shell company naming / thin identity
  for (const subject of subjects) {
    const factors: ScoreFactor[] = [];
    const nameLower = subject.name.toLowerCase();
    const hintHit = hints.find((h) => nameLower.includes(h));
    if (hintHit) {
      factors.push({
        code: "SHELL_NAME",
        label: `Name matches shell hint “${hintHit}”`,
        weight: w.shellCompany,
        contribution: w.shellCompany,
        evidenceRef: subject.id,
      });
    }
    if (!subject.ico && subject.kind !== "PERSON") {
      factors.push({
        code: "MISSING_ICO",
        label: "Company without IČO / registry id",
        weight: w.shellCompany * 0.45,
        contribution: w.shellCompany * 0.45,
        evidenceRef: subject.id,
      });
    }
    const degree = transactions.filter(
      (t) => t.fromSubjectId === subject.id || t.toSubjectId === subject.id,
    ).length;
    if (degree === 1 && hintHit) {
      factors.push({
        code: "THIN_GRAPH",
        label: "Single-edge subject (pass-through risk)",
        weight: w.networkChain * 0.5,
        contribution: w.networkChain * 0.5,
        evidenceRef: subject.id,
      });
    }
    const score = clampScore(factors.reduce((a, f) => a + f.contribution, 0));
    subject.riskScore = Math.max(subject.riskScore, score);
    if (hintHit) {
      subject.kind = "SHELL_SUSPECT";
      if (!subject.flags.includes("shell_suspect")) subject.flags.push("shell_suspect");
    }
    if (score >= config.thresholds.alertMinScore && factors.length) {
      alerts.push(
        makeAlert({
          caseId,
          workspaceId,
          runId,
          ruleVersion: config.ruleVersion,
          ruleId: "shell_company",
          title: `Shell-company indicators: ${subject.name}`,
          description: `Subject scored ${score}/100 from naming and identity factors.`,
          score,
          factors,
          subjectIds: [subject.id],
          transactionIds: [],
        }),
      );
    }
  }

  // Transaction anomalies + high value + cross-border
  const amounts = transactions.map((t) => Math.abs(t.amount)).filter((n) => n > 0);
  const mean = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const variance =
    amounts.length > 1 ? amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length : 0;
  const std = Math.sqrt(variance);

  for (const tx of transactions) {
    const factors: ScoreFactor[] = [];
    const abs = Math.abs(tx.amount);
    if (std > 0 && abs > mean + 2.5 * std) {
      factors.push({
        code: "AMOUNT_OUTLIER",
        label: `Amount ${abs} is >2.5σ above mean (${mean.toFixed(0)})`,
        weight: w.transactionAnomaly,
        contribution: w.transactionAnomaly,
        sourceRow: tx.sourceRow,
        evidenceRef: tx.id,
      });
    }
    if (abs >= config.thresholds.highValueAmount) {
      factors.push({
        code: "HIGH_VALUE",
        label: `High-value transfer ≥ ${config.thresholds.highValueAmount}`,
        weight: w.highValueBurst,
        contribution: w.highValueBurst,
        sourceRow: tx.sourceRow,
        evidenceRef: tx.id,
      });
    }
    if (
      tx.countryFrom &&
      tx.countryTo &&
      tx.countryFrom.toUpperCase() !== tx.countryTo.toUpperCase()
    ) {
      factors.push({
        code: "CROSS_BORDER",
        label: `Cross-border ${tx.countryFrom} → ${tx.countryTo}`,
        weight: w.crossBorder,
        contribution: w.crossBorder,
        sourceRow: tx.sourceRow,
        evidenceRef: tx.id,
      });
    }
    const desc = tx.description.toLowerCase();
    if (/\b(weapon|zbraň|zbran|arms|munice|ammunition|serial)\b/i.test(desc) || tx.commodityCode) {
      factors.push({
        code: "LICENSE_SERIAL_HINT",
        label: "Description/commodity suggests arms or serialised goods",
        weight: w.licenseSerial,
        contribution: w.licenseSerial,
        sourceRow: tx.sourceRow,
        evidenceRef: tx.id,
      });
    }
    const score = clampScore(factors.reduce((a, f) => a + f.contribution, 0));
    tx.riskScore = score;
    if (score >= config.thresholds.alertMinScore && factors.length) {
      alerts.push(
        makeAlert({
          caseId,
          workspaceId,
          runId,
          ruleVersion: config.ruleVersion,
          ruleId: "tx_anomaly",
          title: `Transaction risk ${score}/100: ${tx.fromLabel} → ${tx.toLabel}`,
          description: tx.description || `${tx.amount} ${tx.currency}`,
          score,
          factors,
          subjectIds: [tx.fromSubjectId, tx.toSubjectId].filter(Boolean) as string[],
          transactionIds: [tx.id],
        }),
      );
    }
  }

  // Network chains (A→B→C same day high value)
  const byDay = new Map<string, TransactionRecord[]>();
  for (const tx of transactions) {
    const day = tx.bookedAt.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(tx);
    byDay.set(day, list);
  }
  for (const [, dayTx] of byDay) {
    for (const a of dayTx) {
      for (const b of dayTx) {
        if (a.id === b.id) continue;
        if (a.toSubjectId && a.toSubjectId === b.fromSubjectId) {
          const chainScore = clampScore(w.networkChain + (a.riskScore + b.riskScore) * 0.15);
          relationships.push({
            id: createId("rel"),
            caseId,
            workspaceId,
            fromSubjectId: a.fromSubjectId ?? "",
            toSubjectId: b.toSubjectId ?? "",
            relationType: "CHAIN",
            weight: chainScore / 100,
            evidenceIds: [],
            createdAt: new Date().toISOString(),
          });
          if (chainScore >= config.thresholds.alertMinScore) {
            alerts.push(
              makeAlert({
                caseId,
                workspaceId,
                runId,
                ruleVersion: config.ruleVersion,
                ruleId: "network_chain",
                title: `Same-day chain: ${a.fromLabel} → ${a.toLabel} → ${b.toLabel}`,
                description: "Pass-through pattern on the same booking day.",
                score: chainScore,
                factors: [
                  {
                    code: "CHAIN_EDGE",
                    label: "A→B and B→C share intermediary on same day",
                    weight: w.networkChain,
                    contribution: chainScore,
                    sourceRow: a.sourceRow,
                  },
                ],
                subjectIds: [a.fromSubjectId, a.toSubjectId, b.toSubjectId].filter(
                  Boolean,
                ) as string[],
                transactionIds: [a.id, b.id],
              }),
            );
          }
        }
      }
    }
  }

  await localSubjectRepository.putMany(subjects);
  await localTransactionRepository.putMany(transactions);
  await localRelationshipRepository.clearCase(caseId);
  if (relationships.length) await localRelationshipRepository.putMany(relationships);

  await localAlertRepository.clearCase(caseId);
  await localAlertRepository.putMany(alerts);

  const inputHash = await sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        tx: transactions.map((t) => t.id).sort(),
        sub: subjects.map((s) => s.id).sort(),
        weights: config.weights,
      }),
    ),
  );
  const completedAt = new Date().toISOString();
  await localDetectionRunRepository.put({
    id: runId,
    caseId,
    workspaceId,
    ruleVersion: config.ruleVersion,
    startedAt,
    completedAt,
    alertCount: alerts.length,
    subjectCount: subjects.length,
    transactionCount: transactions.length,
    weightsSnapshot: { ...config.weights },
    inputHash,
  });

  await appendAuditChained({
    id: createId("audit"),
    caseId,
    workspaceId,
    type: "MALTE_DETECTION_RUN",
    createdAt: completedAt,
    message: `Malte detection ${config.ruleVersion}: ${alerts.length} alerts`,
    meta: {
      runId,
      ruleVersion: config.ruleVersion,
      alertCount: alerts.length,
      inputHash,
      weights: config.weights,
    },
  });

  return { runId, alerts, subjects, relationships };
}

function makeAlert(input: {
  caseId: string;
  workspaceId: string;
  runId: string;
  ruleVersion: string;
  ruleId: string;
  title: string;
  description: string;
  score: number;
  factors: ScoreFactor[];
  subjectIds: string[];
  transactionIds: string[];
}): AlertRecord {
  return {
    id: createId("alert"),
    caseId: input.caseId,
    workspaceId: input.workspaceId,
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    title: input.title,
    description: input.description,
    severity: severityFor(input.score),
    status: "NEW",
    score: input.score,
    factors: input.factors,
    subjectIds: input.subjectIds,
    transactionIds: input.transactionIds,
    createdAt: new Date().toISOString(),
    detectionRunId: input.runId,
  };
}
