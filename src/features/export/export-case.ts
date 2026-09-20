import type {
  AiRunRecord,
  AuditEventRecord,
  CaseRecord,
  EntityRecord,
  EvidenceRecord,
  ExtractionRecord,
  FindingRecord,
  TimelineEventRecord,
} from "@/domain/types";
import {
  AUDIT_TYPE_LABEL,
  CASE_STATUS_LABEL,
  CLASSIFICATION_LABEL,
  EPISTEMIC_LABEL,
  EVIDENCE_STATUS_LABEL,
  KIND_LABEL,
  RUN_STATUS_LABEL,
  SECTION_LABEL,
  SECTION_SOURCE_LABEL,
  enumLabel,
} from "@/lib/copy";

export interface CaseExportBundle {
  exportedAt: string;
  format: "forenx-case-v1";
  case: CaseRecord;
  evidence: Array<Omit<EvidenceRecord, never> & { extractedText?: string }>;
  findings: FindingRecord[];
  entities: EntityRecord[];
  timeline: TimelineEventRecord[];
  aiRuns: AiRunRecord[];
  audit: AuditEventRecord[];
}

export function buildCaseExport(input: {
  caseRecord: CaseRecord;
  evidence: EvidenceRecord[];
  extractions: ExtractionRecord[];
  findings: FindingRecord[];
  entities: EntityRecord[];
  timeline: TimelineEventRecord[];
  aiRuns: AiRunRecord[];
  audit: AuditEventRecord[];
}): CaseExportBundle {
  const extractionByEvidence = new Map(input.extractions.map((e) => [e.evidenceId, e]));
  return {
    exportedAt: new Date().toISOString(),
    format: "forenx-case-v1",
    case: input.caseRecord,
    evidence: input.evidence.map((item) => ({
      ...item,
      extractedText: extractionByEvidence.get(item.id)?.text,
    })),
    findings: input.findings,
    entities: input.entities,
    timeline: input.timeline,
    aiRuns: input.aiRuns,
    audit: input.audit,
  };
}

export function exportToMarkdown(bundle: CaseExportBundle): string {
  const lines: string[] = [];
  lines.push(`# ${bundle.case.reference} — ${bundle.case.name}`);
  lines.push("");
  lines.push(`- Klasifikácia: ${enumLabel(CLASSIFICATION_LABEL, bundle.case.classification)}`);
  lines.push(`- Stav: ${enumLabel(CASE_STATUS_LABEL, bundle.case.status)}`);
  lines.push(`- Exportované: ${bundle.exportedAt}`);
  lines.push(`- Popis: ${bundle.case.description || "—"}`);
  lines.push("");
  lines.push("## Inventár dôkazov");
  lines.push("");
  for (const item of bundle.evidence) {
    lines.push(`### ${item.originalName}`);
    lines.push(`- ID: ${item.id}`);
    lines.push(`- SHA-256: \`${item.sha256}\``);
    lines.push(`- Veľkosť: ${item.byteSize} bajtov`);
    lines.push(`- Zistený typ: ${item.detectedMime} (${enumLabel(KIND_LABEL, item.detectedKind)})`);
    lines.push(`- Stav: ${enumLabel(EVIDENCE_STATUS_LABEL, item.status)}`);
    lines.push(
      `- Sekcia: ${enumLabel(SECTION_LABEL, item.section)} (${enumLabel(SECTION_SOURCE_LABEL, item.sectionSource)})`,
    );
    if (item.quarantineReason) lines.push(`- Karanténa: ${item.quarantineReason}`);
    lines.push("");
  }
  lines.push("## Zistenia");
  lines.push("");
  for (const finding of bundle.findings) {
    lines.push(
      `- [${enumLabel(EPISTEMIC_LABEL, finding.epistemicClass)} | ${finding.confidence.toFixed(2)}] ${finding.statement}`,
    );
    for (const ref of finding.sourceReferences) {
      lines.push(`  - zdroj: ${ref.fileName} (${ref.evidenceId})`);
    }
  }
  if (bundle.findings.length === 0) lines.push("_Žiadne zistenia._");
  lines.push("");
  lines.push("## Entity");
  lines.push("");
  for (const entity of bundle.entities) {
    lines.push(`- ${entity.entityType}: ${entity.canonicalValue}`);
  }
  if (bundle.entities.length === 0) lines.push("_Žiadne entity._");
  lines.push("");
  lines.push("## Časová os");
  lines.push("");
  for (const event of bundle.timeline) {
    lines.push(`- ${event.timestampOriginal} (${event.timePrecision}) — ${event.action}`);
  }
  if (bundle.timeline.length === 0) lines.push("_Žiadne udalosti na časovej osi._");
  lines.push("");
  lines.push("## Pôvod AI analýz");
  lines.push("");
  for (const run of bundle.aiRuns) {
    lines.push(
      `- ${run.createdAt} ${run.actionId} ${enumLabel(RUN_STATUS_LABEL, run.status)} model=${run.model ?? "—"} prompt=${run.promptVersion}`,
    );
  }
  lines.push("");
  lines.push("## Záznam udalostí");
  lines.push("");
  for (const event of bundle.audit) {
    lines.push(`- ${event.createdAt} ${enumLabel(AUDIT_TYPE_LABEL, event.type)} — ${event.message}`);
  }
  lines.push("");
  const report = bundle.aiRuns.find((r) => r.actionId === "case-report" && r.status === "COMPLETED");
  if (report?.summary) {
    lines.push("## Zhrnutie poslednej správy o prípade");
    lines.push("");
    lines.push(report.summary);
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
