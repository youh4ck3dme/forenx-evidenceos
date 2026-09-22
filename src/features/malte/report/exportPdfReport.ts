import { jsPDF } from "jspdf";
import type {
  AlertRecord,
  CaseRecord,
  DetectionRuleConfig,
  SubjectRecord,
  TransactionRecord,
} from "@/domain/types";
import { partitionAlerts } from "@/features/malte/alertMetrics";
import { createId } from "@/lib/ids";
import { appendAuditChained } from "@/lib/storage/auditChain";

export interface MalteReportLine {
  text: string;
  size?: number;
  style?: "normal" | "bold";
  gapAfter?: number;
}

/**
 * Text the PDF prints. Live totals and the risk-flag section exclude obsolete
 * reviewed findings; those are listed only under an explicit obsolete heading.
 */
export function buildMalteReportLines(input: {
  caseRecord: Pick<CaseRecord, "reference" | "name">;
  alerts: AlertRecord[];
  subjects: Pick<SubjectRecord, "riskScore" | "name" | "kind" | "flags">[];
  transactions: readonly unknown[];
  config: DetectionRuleConfig | null;
}): MalteReportLine[] {
  const lines: MalteReportLine[] = [];
  const push = (text: string, size?: number, style?: "normal" | "bold", gapAfter?: number) => {
    lines.push({ text, size, style, gapAfter });
  };
  const { live, obsolete } = partitionAlerts(input.alerts);

  push("ForenX / Malte — Forensic triage report", 16, "bold");
  push(`Case: ${input.caseRecord.reference} — ${input.caseRecord.name}`, 11, "bold");
  push(`Generated: ${new Date().toISOString()}`, 9);
  push(`Rule pack: ${input.config?.ruleVersion ?? "n/a"}`, 9, "normal", 8);

  push("1. Executive summary", 12, "bold");
  const critical = live.filter((a) => a.severity === "CRITICAL").length;
  const high = live.filter((a) => a.severity === "HIGH").length;
  const obsoleteNote =
    obsolete.length === 0
      ? ""
      : ` ${obsolete.length} obsolete reviewed finding${obsolete.length === 1 ? "" : "s"} excluded from these totals.`;
  push(
    `${live.length} alerts (${critical} critical, ${high} high) across ${input.subjects.length} subjects and ${input.transactions.length} transactions.${obsoleteNote}`,
    10,
    "normal",
    6,
  );

  push("2. Risk flags (explainable scores)", 12, "bold");
  const top = [...live].sort((a, b) => b.score - a.score).slice(0, 25);
  if (!top.length) push("No live alerts.");
  for (const alert of top) {
    push(`[${alert.severity}] ${alert.score}/100 — ${alert.title}`, 10, "bold");
    push(alert.description, 9);
    for (const f of alert.factors) {
      push(
        `  • ${f.label} (weight ${f.weight.toFixed(1)}, +${f.contribution.toFixed(1)}${f.sourceRow != null ? `, row ${f.sourceRow}` : ""})`,
        8,
      );
    }
    const last = lines[lines.length - 1];
    if (last) last.gapAfter = (last.gapAfter ?? 0) + 4;
  }

  if (obsolete.length) {
    push("Obsolete reviewed findings (excluded from live totals)", 12, "bold");
    const stale = [...obsolete].sort((a, b) => b.score - a.score).slice(0, 25);
    for (const alert of stale) {
      push(
        `[OBSOLETE] [${alert.severity}] ${alert.score}/100 — ${alert.title} (${alert.status})`,
        10,
        "bold",
      );
      push(alert.description, 9);
      const last = lines[lines.length - 1];
      if (last) last.gapAfter = (last.gapAfter ?? 0) + 4;
    }
  }

  push("3. Methodology", 12, "bold");
  push(
    "Scores are deterministic sums of weighted rule factors (0–100, clamped). No machine-learning model is used. Weights are case-configurable; the ruleVersion is recorded on each detection run and alert.",
  );
  if (input.config) {
    const w = input.config.weights;
    push(
      `Weights: shell=${w.shellCompany}, anomaly=${w.transactionAnomaly}, license=${w.licenseSerial}, chain=${w.networkChain}, crossBorder=${w.crossBorder}, highValue=${w.highValueBurst}. Alert threshold=${input.config.thresholds.alertMinScore}.`,
      9,
    );
  }
  const beforeSubjects = lines[lines.length - 1];
  if (beforeSubjects) beforeSubjects.gapAfter = (beforeSubjects.gapAfter ?? 0) + 6;
  push("4. Top subjects by risk", 12, "bold");
  const subjects = [...input.subjects].sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);
  for (const s of subjects) {
    push(
      `${s.riskScore}/100 · ${s.name} (${s.kind})${s.flags.length ? ` [${s.flags.join(", ")}]` : ""}`,
      9,
    );
  }

  return lines;
}

export async function exportMaltePdfReport(input: {
  caseRecord: CaseRecord;
  alerts: AlertRecord[];
  subjects: SubjectRecord[];
  transactions: TransactionRecord[];
  config: DetectionRuleConfig | null;
  workspaceId: string;
}): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;
  const lines = buildMalteReportLines(input);
  for (const entry of lines) {
    const size = entry.size ?? 10;
    const style = entry.style ?? "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(entry.text, 515);
    for (const l of wrapped) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.text(l, margin, y);
      y += size + 4;
    }
    if (entry.gapAfter) y += entry.gapAfter;
  }

  doc.save(`${input.caseRecord.reference}-malte-report.pdf`);

  const { live, obsolete } = partitionAlerts(input.alerts);
  await appendAuditChained({
    id: createId("audit"),
    caseId: input.caseRecord.id,
    workspaceId: input.workspaceId,
    type: "MALTE_REPORT_EXPORTED",
    createdAt: new Date().toISOString(),
    message: `Malte PDF report exported (${live.length} live alerts${obsolete.length ? `, ${obsolete.length} obsolete excluded` : ""})`,
    meta: {
      ruleVersion: input.config?.ruleVersion,
      alertCount: live.length,
      obsoleteCount: obsolete.length,
    },
  });
}
