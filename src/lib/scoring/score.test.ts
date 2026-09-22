import assert from "node:assert/strict";
import test from "node:test";
import { SCORE_ENGINE_VERSION, scoreEntity, scoreEvent, scoreFinding } from "./score.ts";

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
