import type { EpistemicClass, SourceReference } from "@/domain/types";

export const SCORE_ENGINE_VERSION = "1.0.0";

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
