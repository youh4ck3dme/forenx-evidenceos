import * as XLSX from "@keep-lts/xlsx";
import { createId } from "@/lib/ids";
import type { TransactionRecord } from "@/domain/types";

export type TxColumnKey =
  | "bookedAt"
  | "amount"
  | "currency"
  | "fromLabel"
  | "toLabel"
  | "description"
  | "reference"
  | "countryFrom"
  | "countryTo"
  | "commodityCode"
  | "skip";

export const TX_COLUMN_OPTIONS: { key: TxColumnKey; label: string }[] = [
  { key: "bookedAt", label: "Date / booked at" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "fromLabel", label: "From (payer)" },
  { key: "toLabel", label: "To (payee)" },
  { key: "description", label: "Description" },
  { key: "reference", label: "Reference" },
  { key: "countryFrom", label: "Country from" },
  { key: "countryTo", label: "Country to" },
  { key: "commodityCode", label: "Commodity / HS code" },
  { key: "skip", label: "— ignore —" },
];

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  sheetName: string;
}

export async function parseTabularFile(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv")) {
    const text = new TextDecoder("utf-8").decode(buf);
    return parseCsvText(text, file.name);
  }
  const wb = XLSX.read(buf, { type: "array", cellNF: true, cellDates: false });
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const sheet = wb.Sheets[sheetName];
  if (sheet) normalizeExcelDateCells(sheet);
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as (string | number | null)[][];
  const normalized = matrix.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const headers = (normalized[0] ?? []).map((h, i) => h || `Column ${i + 1}`);
  const rows = normalized.slice(1).filter((r) => r.some((c) => c.length > 0));
  return { headers, rows, sheetName };
}

export function parseCsvText(text: string, fileName: string): ParsedSheet {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], sheetName: fileName };
  const delim = detectDelim(lines[0]!);
  const matrix = lines.map((line) => splitCsvLine(line, delim));
  const headers = (matrix[0] ?? []).map((h, i) => h || `Column ${i + 1}`);
  const rows = matrix.slice(1);
  return { headers, rows, sheetName: fileName };
}

function detectDelim(line: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const c = splitCsvLine(line, d).length;
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const EXCEL_DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

/** Excel 1900 date system. Serial 45352 is 2024-03-01 in every timezone. */
export function excelSerialToCalendarDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 32874 || whole > 76701) return null;
  const utc = new Date(Date.UTC(1899, 11, 30) + whole * 86400000);
  return calendarDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function isExcelDateFormat(fmt: string | number | undefined): boolean {
  if (typeof fmt === "number") return EXCEL_DATE_FORMAT_IDS.has(fmt);
  if (!fmt) return false;
  // Positive numbers use the first section. A date picture in a later section
  // (negative / zero / text) must not turn a displayed currency amount into a day.
  const firstSection = fmt.split(";")[0] ?? "";
  const stripped = firstSection.replace(/"[^"]*"/g, "");
  if (/[[\]]/.test(stripped)) return false;
  // Numeric pictures (`#`, `0`) are amounts, not calendar dates.
  if (/[#0]/.test(stripped)) return false;
  const lower = stripped.toLowerCase();
  return /y+/.test(lower) && (/d+/.test(lower) || /m+/.test(lower));
}

function normalizeExcelDateCells(sheet: XLSX.WorkSheet): void {
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith("!")) continue;
    const cell = sheet[addr];
    if (!cell || cell.t !== "n" || typeof cell.v !== "number") continue;
    const fmt = cell.z;
    const format = typeof fmt === "string" || typeof fmt === "number" ? fmt : undefined;
    if (!isExcelDateFormat(format)) continue;
    const iso = excelSerialToCalendarDate(cell.v);
    if (!iso) continue;
    cell.t = "s";
    cell.v = iso;
    cell.w = iso;
  }
}

/**
 * Header text for matching: camelCase and separators become words, diacritics
 * are stripped. Short tokens (`od`, `to`, `sum`) then only match whole words,
 * so `CountryFrom` / `Commodity` are not swallowed by the generic rules.
 */
export function normalizeHeaderLabel(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_RULES: { key: TxColumnKey; test: RegExp }[] = [
  // Specific columns before generic from/to/amount. `od` is inside `commodity`.
  {
    key: "countryFrom",
    test: /\b(country from|from country|krajina od|origin country|source country)\b/,
  },
  {
    key: "countryTo",
    test: /\b(country to|to country|krajina do|destination country|target country)\b/,
  },
  {
    key: "commodityCode",
    test: /\b(commodity|commodities|hs code|hscode|tariff|weapon|zbran\w*|serial|licence|license)\b/,
  },
  { key: "bookedAt", test: /\b(date|datum|booked|value date|posted|booking date)\b/ },
  { key: "amount", test: /\b(amount|suma|sum|value|castka|ciastka)\b/ },
  { key: "currency", test: /\b(currency|curr|mena|ccy)\b/ },
  {
    key: "fromLabel",
    test: /\b(from|payer|platitel\w*|odosiel\w*|debtor|sender)\b|\bod\b/,
  },
  {
    key: "toLabel",
    test: /\b(to|payee|komu|prijem\w*|creditor|beneficiary|receiver)\b/,
  },
  { key: "description", test: /\b(description|desc|popis|purpose|nazov|text|memo|note)\b/ },
  { key: "reference", test: /\b(reference|ref|variable symbol|variabilny|vs)\b/ },
];

/** Heuristic auto-map from header labels. First matching rule wins. */
export function suggestColumnMap(headers: string[]): TxColumnKey[] {
  return headers.map((header) => {
    const label = normalizeHeaderLabel(header);
    if (!label) return "skip";
    for (const rule of HEADER_RULES) {
      if (rule.test.test(label)) return rule.key;
    }
    return "skip";
  });
}

export interface ImportPreviewRow {
  rowIndex: number;
  ok: boolean;
  errors: string[];
  bookedAt: string;
  amount: number;
  currency: string;
  fromLabel: string;
  toLabel: string;
  description: string;
}

export function previewMappedRows(
  sheet: ParsedSheet,
  map: TxColumnKey[],
  limit = 8,
): ImportPreviewRow[] {
  return sheet.rows.slice(0, limit).map((row, i) => validateRow(row, map, i + 2));
}

function cell(row: string[], map: TxColumnKey[], key: TxColumnKey): string {
  const idx = map.indexOf(key);
  if (idx < 0) return "";
  return row[idx] ?? "";
}

/**
 * Parse a money cell. The last `.` or `,` is the decimal mark when both appear
 * (`1.234,56` → 1234.56, `1,234.56` → 1234.56). A repeated separator with
 * groups of three is thousands (`1,250,000`, `1.234.567,89`). A single comma
 * is a decimal mark (`1234,56`).
 */
export function parseAmount(raw: string): number {
  let s = raw.trim();
  if (!s) return NaN;
  s = s.replace(/[\s\u00A0\u202F]/g, "").replace(/[€$£¥]/g, "");
  s = s.replace(/^(eur|usd|gbp|czk|chf|pln|skk)/i, "");
  s = s.replace(/(eur|usd|gbp|czk|chf|pln|skk)$/i, "");
  if (!s) return NaN;

  let sign = 1;
  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("-") || s.startsWith("−")) {
    sign = -1;
    s = s.slice(1);
  }
  s = s.replace(/'/g, "");
  if (!/^[\d.,]+$/.test(s)) return NaN;

  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  let normalized: string;
  if (comma >= 0 && dot >= 0) {
    const decimalIsComma = comma > dot;
    const decimalSep = decimalIsComma ? "," : ".";
    const groupSep = decimalIsComma ? "." : ",";
    const cut = s.lastIndexOf(decimalSep);
    const intRaw = s.slice(0, cut);
    const frac = s.slice(cut + 1);
    if (!isGroupedInteger(intRaw, groupSep) || !/^\d+$/.test(frac)) return NaN;
    normalized = `${intRaw.split(groupSep).join("")}.${frac}`;
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? "," : ".";
    const parts = s.split(sep);
    const allDigits = parts.every((part) => /^\d+$/.test(part));
    if (!allDigits || parts.some((part) => part.length === 0)) return NaN;
    if (parts.length > 2 && parts.slice(1).every((part) => part.length === 3)) {
      normalized = parts.join("");
    } else if (parts.length === 2) {
      normalized = `${parts[0]}.${parts[1]}`;
    } else {
      return NaN;
    }
  } else {
    normalized = s;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  return sign * n;
}

function isGroupedInteger(raw: string, sep: string): boolean {
  if (!raw) return false;
  const parts = raw.split(sep);
  if (parts.some((part) => !/^\d+$/.test(part))) return false;
  if (parts.length === 1) return true;
  if (parts[0]!.length < 1 || parts[0]!.length > 3) return false;
  return parts.slice(1).every((part) => part.length === 3);
}

/**
 * Booking day as `YYYY-MM-DD`. Dotted dates are day.month.year (including days
 * 1–12). Slashes follow SheetJS `m/d/yy` unless that month is impossible.
 * Does not call `Date.parse` — local midnight must not shift the calendar day.
 */
export function parseBookedAt(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dotted =
    /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s);
  if (dotted) {
    return calendarDate(expandYear(dotted[3]!), Number(dotted[2]), Number(dotted[1]));
  }

  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (slashed) {
    const monthFirst = Number(slashed[1]);
    const daySecond = Number(slashed[2]);
    const year = expandYear(slashed[3]!);
    return calendarDate(year, monthFirst, daySecond) ?? calendarDate(year, daySecond, monthFirst);
  }

  if (/^\d{5,6}(?:\.\d+)?$/.test(s)) return excelSerialToCalendarDate(Number(s));

  return null;
}

function expandYear(raw: string): number {
  if (raw.length >= 4) return Number(raw);
  const yy = Number(raw);
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

function calendarDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validateRow(row: string[], map: TxColumnKey[], rowIndex: number): ImportPreviewRow {
  const errors: string[] = [];
  const bookedAtRaw = cell(row, map, "bookedAt");
  const amountRaw = cell(row, map, "amount");
  const fromLabel = cell(row, map, "fromLabel") || "Unknown payer";
  const toLabel = cell(row, map, "toLabel") || "Unknown payee";
  const currency = (cell(row, map, "currency") || "EUR").toUpperCase();
  const description = cell(row, map, "description");
  const amount = parseAmount(amountRaw);
  let bookedAt = "";
  if (!bookedAtRaw) errors.push("Missing date");
  else {
    const parsed = parseBookedAt(bookedAtRaw);
    if (!parsed) errors.push("Invalid date");
    else bookedAt = parsed;
  }
  if (!amountRaw || Number.isNaN(amount)) errors.push("Invalid amount");
  if (!map.includes("fromLabel") && !map.includes("toLabel")) {
    errors.push("Map at least From or To");
  }
  return {
    rowIndex,
    ok: errors.length === 0,
    errors,
    bookedAt,
    amount: Number.isNaN(amount) ? 0 : amount,
    currency,
    fromLabel,
    toLabel,
    description,
  };
}

export function rowsToTransactions(
  sheet: ParsedSheet,
  map: TxColumnKey[],
  ctx: { caseId: string; workspaceId: string; sourceEvidenceId?: string },
): { transactions: TransactionRecord[]; skipped: number; errors: string[] } {
  const transactions: TransactionRecord[] = [];
  const errors: string[] = [];
  let skipped = 0;
  sheet.rows.forEach((row, i) => {
    const preview = validateRow(row, map, i + 2);
    if (!preview.ok) {
      skipped += 1;
      errors.push(`Row ${preview.rowIndex}: ${preview.errors.join("; ")}`);
      return;
    }
    transactions.push({
      id: createId("tx"),
      caseId: ctx.caseId,
      workspaceId: ctx.workspaceId,
      bookedAt: preview.bookedAt,
      amount: preview.amount,
      currency: preview.currency,
      fromLabel: preview.fromLabel,
      toLabel: preview.toLabel,
      description: preview.description,
      reference: cell(row, map, "reference") || undefined,
      countryFrom: cell(row, map, "countryFrom") || undefined,
      countryTo: cell(row, map, "countryTo") || undefined,
      commodityCode: cell(row, map, "commodityCode") || undefined,
      sourceEvidenceId: ctx.sourceEvidenceId,
      sourceRow: preview.rowIndex,
      riskScore: 0,
      createdAt: new Date().toISOString(),
    });
  });
  return { transactions, skipped, errors };
}
