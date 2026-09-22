import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SCORE_ENGINE_VERSION,
  scoreAnomaly,
  scoreCaseRisk,
  scoreEntity,
  scoreEvent,
  scoreFinding,
  scoreQuestion,
} from "./score.ts";

const excerptRef = {
  evidenceId: "ev-1",
  fileName: "vypis.pdf",
  excerpt: "prevod 1 200 EUR dňa 12.3.2024",
};

test("same input always yields the same score", () => {
  const input = {
    epistemicClass: "OBSERVED" as const,
    statement: "Na výpise je uvedená platba 1 200 EUR.",
    sourceReferences: [excerptRef],
    evidenceIds: ["ev-1"],
  };
  const a = scoreFinding(input);
  const b = scoreFinding(input);
  assert.equal(a.confidence, b.confidence);
  assert.deepEqual(a.reasons, b.reasons);
  assert.equal(a.engineVersion, SCORE_ENGINE_VERSION);
});

test("hypothesis without provenance cannot outrank an observed sourced finding", () => {
  const observed = scoreFinding({
    epistemicClass: "OBSERVED",
    statement: "Dokument obsahuje pečiatku notára na strane 2.",
    sourceReferences: [excerptRef],
    evidenceIds: ["ev-1"],
  });
  const hypo = scoreFinding({
    epistemicClass: "HYPOTHESIS",
    statement: "Možno ide o podvod.",
    sourceReferences: [],
    evidenceIds: [],
  });
  assert.ok(observed.confidence > hypo.confidence);
  assert.ok(hypo.confidence <= 0.45);
});

test("LLM-style 0.99 hint is not an input and cannot inflate score", () => {
  const low = scoreFinding({
    epistemicClass: "UNKNOWN",
    statement: "ok",
    sourceReferences: [],
    evidenceIds: [],
  });
  assert.ok(low.confidence <= 0.35);
  assert.ok(low.reasons.some((r) => r.startsWith("base:UNKNOWN")));
});

test("second independent source increases score", () => {
  const one = scoreFinding({
    epistemicClass: "INFERRED",
    statement: "Osoba A vystupuje v dvoch nezávislých dokumentoch.",
    sourceReferences: [excerptRef],
    evidenceIds: ["ev-1"],
  });
  const two = scoreFinding({
    epistemicClass: "INFERRED",
    statement: "Osoba A vystupuje v dvoch nezávislých dokumentoch.",
    sourceReferences: [excerptRef, { evidenceId: "ev-2", fileName: "mail.eml", excerpt: "podpisované rovnakým menom" }],
    evidenceIds: ["ev-1", "ev-2"],
  });
  assert.ok(two.confidence > one.confidence);
});

test("entity without source is scored as inferred", () => {
  const orphan = scoreEntity({ value: "IBAN-UNKNOWN", evidenceIds: [], sourceReferences: [] });
  const sourced = scoreEntity({
    value: "SK00TESTVALUE0001",
    evidenceIds: ["ev-1"],
    sourceReferences: [excerptRef],
  });
  assert.ok(sourced.confidence > orphan.confidence);
});

test("unnormalized timeline timestamp is penalized", () => {
  const raw = scoreEvent({
    action: "Odchod z budovy cez turniket B.",
    timestampNormalized: null,
    sourceReferences: [excerptRef],
  });
  const norm = scoreEvent({
    action: "Odchod z budovy cez turniket B.",
    timestampNormalized: "2024-03-12T18:02:00Z",
    sourceReferences: [excerptRef],
  });
  assert.ok(norm.confidence > raw.confidence);
  assert.ok(raw.reasons.some((r) => r.includes("unnormalizedTime")));
});

test("question is capped as hypothesis", () => {
  const q = scoreQuestion("Kto autorizoval prevod?", ["ev-1"]);
  assert.ok(q.confidence <= 0.45);
  assert.notEqual(q.confidence, 0.4);
  assert.equal(q.engineVersion, SCORE_ENGINE_VERSION);
  assert.ok(q.reasons.some((r) => r.includes("HYPOTHESIS")));
  assert.ok(q.reasons.includes("path:question"));
  assert.ok(q.reasons.some((r) => r.includes("noProvenance")));
});

test("anomaly is inferred and not a hypothesis cap", () => {
  const a = scoreAnomaly("Dátum na faktúre nesedí s dátumom na výpise.", ["ev-1"]);
  const q = scoreQuestion("Kto autorizoval prevod?", ["ev-1"]);
  assert.ok(a.confidence >= q.confidence);
  assert.notEqual(a.confidence, 0.5);
  assert.equal(a.engineVersion, SCORE_ENGINE_VERSION);
  assert.ok(a.reasons.some((r) => r.startsWith("base:INFERRED")));
  assert.ok(a.reasons.includes("path:anomaly"));
  assert.ok(!a.reasons.some((r) => r.includes("HYPOTHESIS")));
});

test("workspace store does not hardcode question or anomaly confidence", () => {
  const src = readFileSync(new URL("../../features/workspace/store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /confidence:\s*0\.4\b/);
  assert.doesNotMatch(src, /confidence:\s*0\.5\b/);
  assert.match(src, /scoreQuestion\(/);
  assert.match(src, /scoreAnomaly\(/);
  assert.match(src, /scoreEngineVersion:\s*scored\.engineVersion/);
  assert.match(src, /scoreReasons:\s*scored\.reasons/);
  assert.match(src, /export function selectCaseRisk/);
});

test("empty case risk is LOW 0", () => {
  const risk = scoreCaseRisk([]);
  assert.equal(risk.index, 0);
  assert.equal(risk.band, "LOW");
});

test("rejected findings do not raise case risk", () => {
  const live = scoreCaseRisk([
    { epistemicClass: "OBSERVED", confidence: 0.8, reviewStatus: "ACCEPTED", statement: "Pečiatka na strane 2." },
    { epistemicClass: "OBSERVED", confidence: 0.8, reviewStatus: "ACCEPTED", statement: "Suma 1200 EUR na výpise." },
    { epistemicClass: "INFERRED", confidence: 0.7, reviewStatus: "PENDING", statement: "Nezrovnalosť: dátum nesedí." },
  ]);
  const withReject = scoreCaseRisk([
    ...[
      { epistemicClass: "OBSERVED" as const, confidence: 0.8, reviewStatus: "ACCEPTED" as const, statement: "Pečiatka na strane 2." },
      { epistemicClass: "OBSERVED" as const, confidence: 0.8, reviewStatus: "ACCEPTED" as const, statement: "Suma 1200 EUR na výpise." },
      { epistemicClass: "INFERRED" as const, confidence: 0.7, reviewStatus: "PENDING" as const, statement: "Nezrovnalosť: dátum nesedí." },
    ],
    { epistemicClass: "OBSERVED", confidence: 0.9, reviewStatus: "REJECTED", statement: "Falošné tvrdenie." },
  ]);
  assert.equal(live.index, withReject.index);
  assert.equal(withReject.rejected, 1);
  assert.ok(live.anomalies >= 1);
});

test("case risk is deterministic", () => {
  const rows = [
    { epistemicClass: "OBSERVED" as const, confidence: 0.84, reviewStatus: "PENDING" as const, statement: "Text A dlhší výrok." },
    { epistemicClass: "HYPOTHESIS" as const, confidence: 0.2, reviewStatus: "PENDING" as const, statement: "Otázka: kto?" },
  ];
  assert.deepEqual(scoreCaseRisk(rows), scoreCaseRisk(rows));
});

test("case risk formula weights confidence and adds question and anomaly bumps", () => {
  const one = scoreCaseRisk([
    { epistemicClass: "OBSERVED", confidence: 0.8, reviewStatus: "ACCEPTED", statement: "Pečiatka na strane 2." },
  ]);
  // mass = 0.8 × 1, denom = max(3, 1) → round(26.666…) = 27
  assert.equal(one.index, 27);
  assert.equal(one.band, "MODERATE");
  assert.equal(one.considered, 1);
  assert.equal(one.engineVersion, SCORE_ENGINE_VERSION);

  const plain = scoreCaseRisk([
    { epistemicClass: "HYPOTHESIS", confidence: 0.2, reviewStatus: "PENDING", statement: "Text bez prefixu." },
  ]);
  const question = scoreCaseRisk([
    { epistemicClass: "HYPOTHESIS", confidence: 0.2, reviewStatus: "PENDING", statement: "Otázka: kto autorizoval?" },
  ]);
  const anomaly = scoreCaseRisk([
    { epistemicClass: "INFERRED", confidence: 0.2, reviewStatus: "PENDING", statement: "Nezrovnalosť: dátum nesedí." },
  ]);
  // mass 0.05 / 3 × 100 = 1.666… → 2; question bump +2
  assert.equal(plain.index, 2);
  assert.equal(question.index, 4);
  assert.equal(question.questions, 1);
  // mass 0.12 / 3 × 100 = 4; anomaly bump +4
  assert.equal(anomaly.index, 8);
  assert.equal(anomaly.anomalies, 1);
});
