/**
 * Malte import + detection checks.
 * Run: npm run test:malte
 *
 * The process timezone is Europe/Bratislava so a Date.parse + toISOString
 * regression fails the booking-day assertions.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "@keep-lts/xlsx";
import {
  excelSerialToCalendarDate,
  parseAmount,
  parseBookedAt,
  parseCsvText,
  parseTabularFile,
  rowsToTransactions,
  suggestColumnMap,
} from "../src/features/malte/import/columnMap.ts";
import {
  alertStableKey,
  preserveAlertReviews,
  runMalteDetection,
} from "../src/features/malte/detection/engine.ts";
import {
  localAlertRepository,
  localTransactionRepository,
} from "../src/lib/storage/repositories.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(HERE, "../e2e/fixtures/malte_ebabcan_sample.csv"), "utf8");

function assertAmount(raw, expected) {
  const got = parseAmount(raw);
  assert.equal(got, expected, `parseAmount(${JSON.stringify(raw)}) → ${got}, expected ${expected}`);
}

function assertDay(raw, expected) {
  const got = parseBookedAt(raw);
  assert.equal(
    got,
    expected,
    `parseBookedAt(${JSON.stringify(raw)}) → ${got}, expected ${expected}`,
  );
}

const sheet = parseCsvText(csv, "malte_ebabcan_sample.csv");
assert.deepEqual(sheet.headers, [
  "Date",
  "Amount",
  "Currency",
  "From",
  "To",
  "Description",
  "CountryFrom",
  "CountryTo",
  "Commodity",
]);
assert.equal(sheet.rows.length, 8);

const fixtureMap = suggestColumnMap(sheet.headers);
assert.deepEqual(fixtureMap, [
  "bookedAt",
  "amount",
  "currency",
  "fromLabel",
  "toLabel",
  "description",
  "countryFrom",
  "countryTo",
  "commodityCode",
]);

const falseFriends = suggestColumnMap([
  "Consumer",
  "Code",
  "Total",
  "Summary",
  "Net amount",
  "Value date",
  "Od",
  "Krajina od",
  "HSCode",
]);
assert.deepEqual(falseFriends, [
  "skip",
  "skip",
  "skip",
  "skip",
  "amount",
  "bookedAt",
  "fromLabel",
  "countryFrom",
  "commodityCode",
]);

const imported = rowsToTransactions(sheet, fixtureMap, {
  caseId: "case_fixture",
  workspaceId: "ws_test",
});
assert.equal(imported.skipped, 0, imported.errors.join("\n"));
assert.equal(imported.transactions.length, 8);
const withCountries = imported.transactions.filter((tx) => tx.countryFrom && tx.countryTo);
assert.equal(withCountries.length, 8);
const crossBorder = withCountries.filter(
  (tx) => tx.countryFrom.toUpperCase() !== tx.countryTo.toUpperCase(),
);
assert.ok(crossBorder.length >= 4, `expected cross-border rows, got ${crossBorder.length}`);
const withCommodity = imported.transactions.filter((tx) => tx.commodityCode);
assert.equal(withCommodity.length, 2);
assert.deepEqual(withCommodity.map((tx) => tx.commodityCode).sort(), ["9301", "9306"]);

assertAmount("1.234,56", 1234.56);
assertAmount("1.234.567,89", 1234567.89);
assertAmount("1234,56", 1234.56);
assertAmount("1 234,56", 1234.56);
assertAmount("1\u00A0234,56", 1234.56);
assertAmount("1,234.56", 1234.56);
assertAmount("1,250,000", 1250000);
assertAmount("12500", 12500);
assertAmount("12.50", 12.5);
assertAmount("-1.234,56", -1234.56);
assert.ok(Number.isNaN(parseAmount("")));
assert.ok(Number.isNaN(parseAmount("abc")));

const euSheet = {
  headers: ["Datum", "Suma", "Mena", "Od", "Komu"],
  rows: [
    ["01.03.2024", "1.234,56", "EUR", "Babcan Holding s.r.o.", "Arms Trade SK Ltd"],
    ["13.03.2024", "1.234.567,89", "EUR", "A", "B"],
    ["1. 3. 2024", "1234,56", "EUR", "A", "B"],
    ["3/1/24", "1,234.56", "EUR", "A", "B"],
  ],
  sheetName: "eu.csv",
};
const euMap = suggestColumnMap(euSheet.headers);
assert.deepEqual(euMap, ["bookedAt", "amount", "currency", "fromLabel", "toLabel"]);
const eu = rowsToTransactions(euSheet, euMap, { caseId: "case_eu", workspaceId: "ws_test" });
assert.equal(eu.skipped, 0, eu.errors.join("\n"));
assert.deepEqual(
  eu.transactions.map((tx) => tx.bookedAt),
  ["2024-03-01", "2024-03-13", "2024-03-01", "2024-03-01"],
);
assert.deepEqual(
  eu.transactions.map((tx) => tx.amount),
  [1234.56, 1234567.89, 1234.56, 1234.56],
);

assertDay("01.03.2024", "2024-03-01");
assertDay("13.03.2024", "2024-03-13");
assertDay("1. 3. 2024", "2024-03-01");
assertDay("3/1/24", "2024-03-01");
assertDay("2024-03-01", "2024-03-01");
assertDay("31.02.2024", null);
assertDay("45352", "2024-03-01");
assert.equal(excelSerialToCalendarDate(45352), "2024-03-01");
assert.equal(parseBookedAt("01.03.2024").length, 10);

const xlsxBook = XLSX.utils.book_new();
const xlsxSheet = XLSX.utils.aoa_to_sheet([
  ["Date", "Amount", "From", "To"],
  [new Date(Date.UTC(2024, 2, 1)), 1234.56, "Alpha", "Beta"],
]);
XLSX.utils.book_append_sheet(xlsxBook, xlsxSheet, "Sheet1");
const xlsxFile = new File(
  [XLSX.write(xlsxBook, { type: "buffer", bookType: "xlsx" })],
  "march.xlsx",
);
const xlsxParsed = await parseTabularFile(xlsxFile);
assert.equal(xlsxParsed.rows[0][0], "2024-03-01");
const xlsxImported = rowsToTransactions(xlsxParsed, suggestColumnMap(xlsxParsed.headers), {
  caseId: "case_xlsx",
  workspaceId: "ws_test",
});
assert.equal(xlsxImported.skipped, 0, xlsxImported.errors.join("\n"));
assert.equal(xlsxImported.transactions[0].bookedAt, "2024-03-01");
assert.equal(xlsxImported.transactions[0].amount, 1234.56);

// A currency picture that hides a date format in a later Excel section must
// stay an amount. SheetJS renders 45352 as "45,352.00 EUR"; rewriting it to a
// calendar day would drop the row.
const stealthBook = XLSX.utils.book_new();
const stealthSheet = XLSX.utils.aoa_to_sheet([
  ["Date", "Amount", "From", "To"],
  ["01.03.2024", 45352, "Alpha", "Beta"],
  ["02.03.2024", 10.5, "Alpha", "Beta"],
  ["05.03.2024", 50000, "Alpha", "Beta"],
]);
for (const addr of ["B2", "B3", "B4"]) {
  stealthSheet[addr].z = '#,##0.00 "EUR";yyyy-mm-dd';
}
XLSX.utils.book_append_sheet(stealthBook, stealthSheet, "Sheet1");
const stealthFile = new File(
  [XLSX.write(stealthBook, { type: "buffer", bookType: "xlsx" })],
  "stealth.xlsx",
);
const stealthParsed = await parseTabularFile(stealthFile);
const stealthImported = rowsToTransactions(stealthParsed, suggestColumnMap(stealthParsed.headers), {
  caseId: "case_stealth",
  workspaceId: "ws_test",
});
assert.equal(stealthImported.skipped, 0, stealthImported.errors.join("\n"));
assert.deepEqual(
  stealthImported.transactions.map((tx) => tx.amount),
  [45352, 10.5, 50000],
);

const caseId = "case_review";
const workspaceId = "ws_test";
await localTransactionRepository.putMany(
  imported.transactions.map((tx) => ({ ...tx, caseId, workspaceId })),
);

const first = await runMalteDetection(caseId, workspaceId);
const alerts1 = await localAlertRepository.listByCase(caseId);
assert.equal(alerts1.length, first.alerts.length);
assert.equal(new Set(alerts1.map((alert) => alertStableKey(alert))).size, alerts1.length);
assert.ok(alerts1.length >= 3, `expected alerts from the fixture, got ${alerts1.length}`);
assert.ok(
  alerts1.some((alert) => alert.factors.some((factor) => factor.code === "CROSS_BORDER")),
  "auto-mapped countries did not produce a cross-border alert",
);

const reviewed = alerts1[0];
const escalated = alerts1[1];
const lookedAt = alerts1[2];
const reviewedAt = "2024-03-20T12:00:00.000Z";
await localAlertRepository.update(reviewed.id, {
  status: "FALSE_POSITIVE",
  reviewedAt,
  reviewedBy: "analyst",
  reviewNote: "known pass-through",
});
await localAlertRepository.update(escalated.id, {
  status: "ESCALATED",
  reviewedAt,
  reviewedBy: "analyst",
});
await localAlertRepository.update(lookedAt.id, {
  status: "REVIEWED",
  reviewedAt,
  reviewedBy: "analyst",
});

const second = await runMalteDetection(caseId, workspaceId);
const alerts2 = await localAlertRepository.listByCase(caseId);
assert.equal(alerts2.length, second.alerts.length);

for (const [id, status, note] of [
  [reviewed.id, "FALSE_POSITIVE", "known pass-through"],
  [escalated.id, "ESCALATED", undefined],
  [lookedAt.id, "REVIEWED", undefined],
]) {
  const found = alerts2.find((alert) => alert.id === id);
  assert.ok(found, `re-run deleted reviewed alert ${id} (${status})`);
  assert.equal(found.status, status);
  assert.equal(found.reviewedBy, "analyst");
  assert.equal(found.reviewedAt, reviewedAt);
  if (note) assert.equal(found.reviewNote, note);
  assert.equal(found.obsolete, false);
  const dupes = alerts2.filter((alert) => alertStableKey(alert) === alertStableKey(found));
  assert.equal(dupes.length, 1, `stable finding ${alertStableKey(found)} was duplicated`);
}

const shellHits = imported.transactions.filter((tx) => {
  const blob = `${tx.fromLabel} ${tx.toLabel}`.toLowerCase();
  return ["s.r.o.", "ltd", "offshore", "shell", "holding", "babcan"].some((hint) =>
    blob.includes(hint),
  );
}).length;
assert.ok(shellHits >= 4, `expected shell hits, got ${shellHits}`);

function finding(partial) {
  return {
    caseId: "case_review",
    workspaceId: "ws_test",
    ruleVersion: "malte-rules-v1.0.0",
    title: "t",
    description: "d",
    severity: "HIGH",
    factors: [],
    subjectIds: [],
    transactionIds: [],
    createdAt: "2024-03-01T00:00:00.000Z",
    detectionRunId: "drun_old",
    ...partial,
  };
}
const reconciled = preserveAlertReviews(
  [
    finding({
      id: "alert_live",
      ruleId: "tx_anomaly",
      status: "FALSE_POSITIVE",
      score: 50,
      transactionIds: ["tx_live"],
      subjectIds: ["s9"],
      reviewedBy: "analyst",
      reviewNote: "ok",
    }),
    finding({
      id: "alert_stale",
      ruleId: "tx_anomaly",
      status: "ESCALATED",
      score: 40,
      transactionIds: ["tx_gone"],
      subjectIds: ["s1", "s2"],
      reviewedAt: "2024-03-04T00:00:00.000Z",
      reviewedBy: "analyst",
    }),
    finding({
      id: "alert_new_gone",
      ruleId: "network_chain",
      status: "NEW",
      score: 36,
      transactionIds: ["tx_a", "tx_b"],
      subjectIds: ["s1", "s2", "s3"],
    }),
  ],
  [
    finding({
      id: "alert_new_id",
      ruleId: "tx_anomaly",
      status: "NEW",
      score: 90,
      title: "refreshed",
      transactionIds: ["tx_live"],
      subjectIds: ["s9"],
      detectionRunId: "drun_new",
      createdAt: "2024-04-01T00:00:00.000Z",
    }),
  ],
);
const live = reconciled.find((alert) => alert.id === "alert_live");
assert.ok(live);
assert.equal(live.status, "FALSE_POSITIVE");
assert.equal(live.score, 90);
assert.equal(live.title, "refreshed");
assert.equal(live.reviewNote, "ok");
assert.equal(live.obsolete, false);
assert.equal(
  reconciled.find((alert) => alert.id === "alert_new_id"),
  undefined,
);
const stale = reconciled.find((alert) => alert.id === "alert_stale");
assert.ok(stale);
assert.equal(stale.status, "ESCALATED");
assert.equal(stale.reviewedBy, "analyst");
assert.equal(stale.obsolete, true);
assert.equal(
  reconciled.some((alert) => alert.id === "alert_new_gone"),
  false,
);

console.log("malte engine OK", {
  rows: imported.transactions.length,
  cross: crossBorder.length,
  alerts: alerts2.length,
  preserved: ["FALSE_POSITIVE", "ESCALATED", "REVIEWED"],
});
