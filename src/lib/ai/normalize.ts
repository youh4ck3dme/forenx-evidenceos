import type {
  EntityRecord,
  EpistemicClass,
  EvidenceSection,
  FindingRecord,
  SourceReference,
  TimelineEventRecord,
} from "@/domain/types";
import { EVIDENCE_SECTIONS, EPISTEMIC_CLASSES } from "@/domain/types";
import { createId } from "@/lib/ids";

export interface NormalizedAnalysis {
  title: string;
  summary: string;
  primarySection: EvidenceSection | null;
  findings: Omit<FindingRecord, "id" | "caseId" | "actionId" | "promptVersion" | "model" | "createdAt" | "reviewStatus" | "runId">[];
  entities: Omit<EntityRecord, "id" | "caseId" | "createdAt" | "runId">[];
  events: Omit<TimelineEventRecord, "id" | "caseId" | "createdAt" | "runId" | "eventId">[];
  questions: string[];
  anomalies: string[];
  reportMarkdown: string | null;
}

type Loose = Record<string, unknown>;

function asObj(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function asStr(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function epistemic(value: unknown): EpistemicClass {
  const v = asStr(value).toUpperCase();
  return (EPISTEMIC_CLASSES as readonly string[]).includes(v) ? (v as EpistemicClass) : "UNKNOWN";
}

function sectionOf(value: unknown): EvidenceSection | null {
  const v = asStr(value).toUpperCase();
  return (EVIDENCE_SECTIONS as readonly string[]).includes(v) ? (v as EvidenceSection) : null;
}

function ref(item: Loose, fallbackName: string): SourceReference | null {
  const evidenceId = asStr(item.evidenceId);
  if (!evidenceId) return null;
  const pageRaw = item.page;
  const page = typeof pageRaw === "number" ? pageRaw : undefined;
  return {
    evidenceId,
    fileName: asStr(item.fileName) || fallbackName,
    page,
    excerpt: asStr(item.excerpt) || undefined,
  };
}

export function normalizeAnalysis(raw: unknown): NormalizedAnalysis {
  const root = asObj(raw);
  const findingsIn = asArr(root.findings);
  const entitiesIn = asArr(root.entities);
  const eventsIn = asArr(root.events);

  const findings: NormalizedAnalysis["findings"] = findingsIn.map((f) => {
    const item = asObj(f);
    const source = ref(item, asStr(item.fileName) || "evidence");
    return {
      evidenceIds: source ? [source.evidenceId] : [],
      statement: asStr(item.statement) || asStr(item.text),
      epistemicClass: epistemic(item.epistemicClass),
      confidence: asNum(item.confidence, 0.5),
      sourceReferences: source ? [source] : [],
    };
  }).filter((f) => f.statement.trim().length > 0);

  const entities: NormalizedAnalysis["entities"] = entitiesIn.map((e) => {
    const item = asObj(e);
    const source = ref(item, asStr(item.fileName) || "evidence");
    const value = asStr(item.canonicalValue) || asStr(item.value);
    return {
      entityType: asStr(item.entityType) || "OTHER_IDENTIFIER",
      canonicalValue: value,
      originalRepresentation: asStr(item.originalRepresentation) || value,
      aliases: asArr(item.aliases).map(asStr).filter(Boolean),
      evidenceIds: source ? [source.evidenceId] : [],
      sourceReferences: source ? [source] : [],
      confidence: asNum(item.confidence, 0.5),
    };
  }).filter((e) => e.canonicalValue.trim().length > 0);

  const events: NormalizedAnalysis["events"] = eventsIn.map((ev) => {
    const item = asObj(ev);
    const source = ref(item, asStr(item.fileName) || "evidence");
    return {
      timestampOriginal: asStr(item.timestampOriginal) || "UNKNOWN",
      timestampNormalized: asStr(item.timestampNormalized) || null,
      timezone: asStr(item.timezone) || null,
      timePrecision: asStr(item.timePrecision) || "UNKNOWN",
      eventType: asStr(item.eventType) || "EVENT",
      actors: asArr(item.actors).map(asStr).filter(Boolean),
      action: asStr(item.action) || asStr(item.statement),
      objects: asArr(item.objects).map(asStr).filter(Boolean),
      location: asStr(item.location) || null,
      sourceReferences: source ? [source] : [],
      confidence: asNum(item.confidence, 0.5),
    };
  }).filter((e) => e.action.trim().length > 0);

  const questions = asArr(root.questions).map(asStr).filter(Boolean);
  const anomalies = asArr(root.anomalies).map(asStr).filter(Boolean);

  if (findings.length === 0 && asStr(root.summary)) {
    findings.push({
      evidenceIds: [],
      statement: asStr(root.summary),
      epistemicClass: "INFERRED",
      confidence: 0.4,
      sourceReferences: [],
    });
  }

  return {
    title: asStr(root.title) || "Analysis",
    summary: asStr(root.summary),
    primarySection: sectionOf(root.primarySection),
    findings,
    entities,
    events,
    questions,
    anomalies,
    reportMarkdown: asStr(root.reportMarkdown) || null,
  };
}

export function newFindingId(): string {
  return createId("find");
}
