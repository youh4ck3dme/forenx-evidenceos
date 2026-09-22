import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseExport, exportToMarkdown } from "./export-case.ts";
import { SCORE_ENGINE_VERSION } from "../../lib/scoring/score.ts";
import type { CaseRecord, FindingRecord } from "../../domain/types.ts";

const caseRecord = {
  id: "case-1",
  workspaceId: "local-workspace",
  name: "Test",
  reference: "FX-0001",
  description: "Lokálny test",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: "ACTIVE",
  classification: "CONFIDENTIAL",
  tags: [],
} as CaseRecord;

const finding = {
  id: "find-1",
  caseId: "case-1",
  evidenceIds: ["ev-1"],
  actionId: "extract-entities",
  promptVersion: "1.0.0",
  model: "mistral-large-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  statement: "Na výpise je uvedená platba 1 200 EUR.",
  epistemicClass: "OBSERVED",
  confidence: 0.84,
  sourceReferences: [{ evidenceId: "ev-1", fileName: "vypis.pdf" }],
  reviewStatus: "PENDING",
  runId: "run-1",
  scoreEngineVersion: SCORE_ENGINE_VERSION,
  scoreReasons: ["base:OBSERVED=0.72", "+sourceRef=0.12"],
} as FindingRecord;

test("bundle carries engine version and computed risk", () => {
  const bundle = buildCaseExport({
    caseRecord,
    evidence: [],
    extractions: [],
    findings: [finding],
    entities: [],
    timeline: [],
    aiRuns: [],
    audit: [],
  });
  assert.equal(bundle.scoreEngineVersion, SCORE_ENGINE_VERSION);
  assert.equal(bundle.format, "forenx-case-v1");
  assert.ok(bundle.risk.index >= 0);
  assert.ok(["LOW", "MODERATE", "ELEVATED", "HIGH"].includes(bundle.risk.band));
});

test("markdown states risk is not a guilt verdict", () => {
  const bundle = buildCaseExport({
    caseRecord,
    evidence: [],
    extractions: [],
    findings: [finding],
    entities: [],
    timeline: [],
    aiRuns: [],
    audit: [],
  });
  const md = exportToMarkdown(bundle);
  assert.match(md, /nie je verdikt viny/);
  assert.match(md, new RegExp(SCORE_ENGINE_VERSION));
  assert.match(md, /scoring: base:OBSERVED/);
});
