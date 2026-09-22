import { jsPDF } from "jspdf";
import type {
  AlertRecord,
  CaseRecord,
  DetectionRuleConfig,
  SubjectRecord,
  TransactionRecord,
} from "@/domain/types";
import { createId } from "@/lib/ids";
import { appendAuditChained } from "@/lib/storage/auditChain";

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
  const line = (text: string, size = 10, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 515);
    for (const l of lines) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.text(l, margin, y);
      y += size + 4;
    }
  };

  line("ForenX / Malte — Forensic triage report", 16, "bold");
  line(`Case: ${input.caseRecord.reference} — ${input.caseRecord.name}`, 11, "bold");
  line(`Generated: ${new Date().toISOString()}`, 9);
  line(`Rule pack: ${input.config?.ruleVersion ?? "n/a"}`, 9);
  y += 8;

  line("1. Executive summary", 12, "bold");
  const critical = input.alerts.filter((a) => a.severity === "CRITICAL").length;
  const high = input.alerts.filter((a) => a.severity === "HIGH").length;
  line(
    `${input.alerts.length} alerts (${critical} critical, ${high} high) across ${input.subjects.length} subjects and ${input.transactions.length} transactions.`,
  );
  y += 6;

  line("2. Risk flags (explainable scores)", 12, "bold");
  const top = [...input.alerts].sort((a, b) => b.score - a.score).slice(0, 25);
  if (!top.length) line("No alerts in this run.");
  for (const alert of top) {
    line(`[${alert.severity}] ${alert.score}/100 — ${alert.title}`, 10, "bold");
    line(alert.description, 9);
    for (const f of alert.factors) {
      line(
        `  • ${f.label} (weight ${f.weight.toFixed(1)}, +${f.contribution.toFixed(1)}${f.sourceRow != null ? `, row ${f.sourceRow}` : ""})`,
        8,
      );
    }
    y += 4;
  }

  y += 4;
  line("3. Methodology", 12, "bold");
  line(
    "Scores are deterministic sums of weighted rule factors (0–100, clamped). No machine-learning model is used. Weights are case-configurable; the ruleVersion is recorded on each detection run and alert.",
  );
  if (input.config) {
    const w = input.config.weights;
    line(
      `Weights: shell=${w.shellCompany}, anomaly=${w.transactionAnomaly}, license=${w.licenseSerial}, chain=${w.networkChain}, crossBorder=${w.crossBorder}, highValue=${w.highValueBurst}. Alert threshold=${input.config.thresholds.alertMinScore}.`,
      9,
    );
  }
  y += 6;
  line("4. Top subjects by risk", 12, "bold");
  const subjects = [...input.subjects].sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);
  for (const s of subjects) {
    line(
      `${s.riskScore}/100 · ${s.name} (${s.kind})${s.flags.length ? ` [${s.flags.join(", ")}]` : ""}`,
      9,
    );
  }

  doc.save(`${input.caseRecord.reference}-malte-report.pdf`);

  await appendAuditChained({
    id: createId("audit"),
    caseId: input.caseRecord.id,
    workspaceId: input.workspaceId,
    type: "MALTE_REPORT_EXPORTED",
    createdAt: new Date().toISOString(),
    message: `Malte PDF report exported (${input.alerts.length} alerts)`,
    meta: {
      ruleVersion: input.config?.ruleVersion,
      alertCount: input.alerts.length,
    },
  });
}
