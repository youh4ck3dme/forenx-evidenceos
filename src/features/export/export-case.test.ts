import assert from "node:assert/strict";
import test from "node:test";
import { SCORE_ENGINE_VERSION, formatRiskLine, scoreCaseRisk } from "../../lib/scoring/score.ts";

test("empty export risk line is LOW and denies guilt verdict", () => {
  const risk = scoreCaseRisk([]);
  const line = formatRiskLine(risk);
  assert.equal(risk.index, 0);
  assert.equal(risk.band, "LOW");
  assert.equal(risk.engineVersion, SCORE_ENGINE_VERSION);
  assert.match(line, /nie je verdikt viny/);
  assert.match(line, /0 \(LOW\)/);
});

test("accepted observed findings raise index above empty case", () => {
  const empty = scoreCaseRisk([]);
  const live = scoreCaseRisk([
    {
      epistemicClass: "OBSERVED",
      confidence: 0.84,
      reviewStatus: "ACCEPTED",
      statement: "Na výpise je uvedená platba 1 200 EUR.",
    },
    {
      epistemicClass: "INFERRED",
      confidence: 0.5,
      reviewStatus: "PENDING",
      statement: "Nezrovnalosť: dátum na faktúre nesedí.",
    },
  ]);
  assert.ok(live.index > empty.index);
  assert.match(formatRiskLine(live), /nie je verdikt viny/);
});
