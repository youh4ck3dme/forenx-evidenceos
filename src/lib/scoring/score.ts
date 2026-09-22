import type { EpistemicClass, ReviewStatus, SourceReference } from "@/domain/types";

export const SCORE_ENGINE_VERSION = "1.1.0";

export const SCORE_MIN = 0.08;
export const SCORE_MAX = 0.92;

const BASE: Record<EpistemicClass, number> = {
  OBSERVED: 0.72,
  DERIVED: 0.6,
  INFERRED: 0.42,
  HYPOTHESIS: 0.22,
  UNKNOWN: 0.15,
};

export interface ScoreInput {
  epistemicClass: EpistemicClass;
  statement: string;
  sourceReferences: SourceReference[];
  evidenceIds: string[];
}

export interface ScoreResult {
  confidence: number;
  reasons: string[];
  engineVersion: string;
}

export type CaseRiskBand = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";

export interface CaseRiskInput {
  epistemicClass: EpistemicClass;
  confidence: number;
  reviewStatus: ReviewStatus;
  statement: string;
}

export interface CaseRiskResult {
  index: number;
  band: CaseRiskBand;
  considered: number;
  rejected: number;
  anomalies: number;
  questions: number;
  reasons: string[];
  engineVersion: string;
}

function clamp(n: number): number {
  const rounded = Math.round(Math.min(SCORE_MAX, Math.max(SCORE_MIN, n)) * 100) / 100;
  return rounded;
}

export function scoreFinding(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  let value = BASE[input.epistemicClass] ?? BASE.UNKNOWN;
  reasons.push(`base:${input.epistemicClass}=${value.toFixed(2)}`);

  const refs = input.sourceReferences.filter((r) => r.evidenceId);
  const evidenceIds = new Set([
    ...input.evidenceIds.filter(Boolean),
    ...refs.map((r) => r.evidenceId),
  ]);

  if (refs.length >= 1) {
    value += 0.12;
    reasons.push("+sourceRef=0.12");
  }
  if (refs.length >= 2) {
    value += 0.08;
    reasons.push("+multiSource=0.08");
  }
  if (refs.some((r) => (r.excerpt ?? "").trim().length >= 12)) {
    value += 0.06;
    reasons.push("+excerpt=0.06");
  }
  if (evidenceIds.size >= 2) {
    value += 0.04;
    reasons.push("+multiEvidence=0.04");
  }

  if (refs.length === 0 && input.epistemicClass !== "OBSERVED") {
    value -= 0.18;
    reasons.push("-noProvenance=0.18");
  }

  const statement = input.statement.trim();
  if (statement.length < 24) {
    value -= 0.1;
    reasons.push("-shortStatement=0.10");
  }
  if (/^\s*(otázka|question)\s*:/i.test(statement) || statement.endsWith("?")) {
    value -= 0.08;
    reasons.push("-interrogative=0.08");
  }
  if (input.epistemicClass === "HYPOTHESIS") {
    value = Math.min(value, 0.45);
    reasons.push("cap:HYPOTHESIS<=0.45");
  }
  if (input.epistemicClass === "UNKNOWN") {
    value = Math.min(value, 0.35);
    reasons.push("cap:UNKNOWN<=0.35");
  }

  return {
    confidence: clamp(value),
    reasons,
    engineVersion: SCORE_ENGINE_VERSION,
  };
}

export function scoreEntity(input: {
  value: string;
  evidenceIds: string[];
  sourceReferences: SourceReference[];
}): ScoreResult {
  const classHint: EpistemicClass = input.sourceReferences.length ? "OBSERVED" : "INFERRED";
  return scoreFinding({
    epistemicClass: classHint,
    statement: input.value,
    sourceReferences: input.sourceReferences,
    evidenceIds: input.evidenceIds,
  });
}

export function scoreEvent(input: {
  action: string;
  timestampNormalized: string | null;
  sourceReferences: SourceReference[];
}): ScoreResult {
  const classHint: EpistemicClass = input.timestampNormalized ? "DERIVED" : "INFERRED";
  const scored = scoreFinding({
    epistemicClass: classHint,
    statement: input.action,
    sourceReferences: input.sourceReferences,
    evidenceIds: input.sourceReferences.map((r) => r.evidenceId),
  });
  if (!input.timestampNormalized) {
    const confidence = clamp(scored.confidence - 0.06);
    return {
      ...scored,
      confidence,
      reasons: [...scored.reasons, "-unnormalizedTime=0.06"],
    };
  }
  return scored;
}

export function scoreQuestion(text: string, evidenceIds: string[]): ScoreResult {
  const scored = scoreFinding({
    epistemicClass: "HYPOTHESIS",
    statement: `Otázka: ${text}`,
    sourceReferences: [],
    evidenceIds,
  });
  return { ...scored, reasons: [...scored.reasons, "path:question"] };
}

export function scoreAnomaly(text: string, evidenceIds: string[]): ScoreResult {
  const scored = scoreFinding({
    epistemicClass: "INFERRED",
    statement: `Nezrovnalosť: ${text}`,
    sourceReferences: [],
    evidenceIds,
  });
  return { ...scored, reasons: [...scored.reasons, "path:anomaly"] };
}

const CLASS_WEIGHT: Record<EpistemicClass, number> = {
  OBSERVED: 1,
  DERIVED: 0.8,
  INFERRED: 0.6,
  HYPOTHESIS: 0.25,
  UNKNOWN: 0.1,
};

export function bandForIndex(index: number): CaseRiskBand {
  if (index >= 75) return "HIGH";
  if (index >= 50) return "ELEVATED";
  if (index >= 25) return "MODERATE";
  return "LOW";
}

/**
 * Investigative workload index, not a guilt or authenticity verdict.
 *
 * Rejected findings are skipped.
 * mass = Σ confidence × classWeight
 *   OBSERVED 1 · DERIVED 0.8 · INFERRED 0.6 · HYPOTHESIS 0.25 · UNKNOWN 0.1
 * index = round(clamp 0..100, (mass / max(3, considered)) × 100 + 4×anomalies + 2×questions)
 * Anomaly: statement starts with "Nezrovnalos…". Question: statement starts with "Otázka:".
 * Bands: <25 LOW · <50 MODERATE · <75 ELEVATED · else HIGH.
 */
export function scoreCaseRisk(findings: CaseRiskInput[]): CaseRiskResult {
  const reasons: string[] = [];
  if (findings.length === 0) {
    return {
      index: 0,
      band: "LOW",
      considered: 0,
      rejected: 0,
      anomalies: 0,
      questions: 0,
      reasons: ["empty-case"],
      engineVersion: SCORE_ENGINE_VERSION,
    };
  }

  let mass = 0;
  let rejected = 0;
  let considered = 0;
  let anomalies = 0;
  let questions = 0;

  for (const f of findings) {
    if (f.reviewStatus === "REJECTED") {
      rejected += 1;
      continue;
    }
    considered += 1;
    const weight = CLASS_WEIGHT[f.epistemicClass] ?? CLASS_WEIGHT.UNKNOWN;
    mass += f.confidence * weight;
    if (/^\s*nezrovnalos/i.test(f.statement)) anomalies += 1;
    if (/^\s*otázka\s*:/i.test(f.statement)) questions += 1;
  }

  const denom = Math.max(3, considered);
  let index = (mass / denom) * 100;
  index += anomalies * 4;
  index += questions * 2;
  index = Math.round(Math.min(100, Math.max(0, index)));

  reasons.push(`mass=${mass.toFixed(2)}`);
  reasons.push(`considered=${considered}`);
  reasons.push(`rejected=${rejected}`);
  reasons.push(`anomalies=${anomalies}`);
  reasons.push(`questions=${questions}`);

  return {
    index,
    band: bandForIndex(index),
    considered,
    rejected,
    anomalies,
    questions,
    reasons,
    engineVersion: SCORE_ENGINE_VERSION,
  };
}

export function formatRiskLine(risk: CaseRiskResult): string {
  return `Vyšetrovací index: ${risk.index} (${risk.band}) — nie je verdikt viny; počíta ho kód, nie model.`;
}
