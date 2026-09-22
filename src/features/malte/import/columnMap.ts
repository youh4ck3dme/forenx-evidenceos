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
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const sheet = wb.Sheets[sheetName];
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

function parseCsvText(text: string, fileName: string): ParsedSheet {
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

/** Heuristic auto-map from header labels. */
export function suggestColumnMap(headers: string[]): TxColumnKey[] {
  return headers.map((h) => {
    const x = h.toLowerCase();
    if (/date|datum|booked|value.?date|posted/.test(x)) return "bookedAt";
    if (/amount|suma|sum|value|castka|čiastka|ciastka/.test(x)) return "amount";
    if (/curr|mena|ccy|currency/.test(x)) return "currency";
    if (/from|payer|od|platitel|odosiel|debtor|sender/.test(x)) return "fromLabel";
    if (/to|payee|komu|prijem|creditor|beneficiary|receiver/.test(x)) return "toLabel";
    if (/desc|popis|purpose|nazov|text|memo/.test(x)) return "description";
    if (/ref|vs|variable|reference/.test(x)) return "reference";
    if (/country.?from|from.?country|krajina.?od/.test(x)) return "countryFrom";
    if (/country.?to|to.?country|krajina.?do/.test(x)) return "countryTo";
    if (/commodity|hs.?code|zbran|weapon|serial|licence|license/.test(x)) return "commodityCode";
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

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(/€|\$|£/g, "");
  if (!cleaned) return NaN;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "")
      : cleaned.includes(",")
        ? cleaned.replace(",", ".")
        : cleaned;
  return Number(normalized);
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
  let bookedAt = bookedAtRaw;
  if (!bookedAtRaw) errors.push("Missing date");
  else {
    const d = new Date(bookedAtRaw);
    if (Number.isNaN(d.getTime())) {
      // try DD.MM.YYYY
      const m = bookedAtRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (m) {
        const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
        bookedAt = `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
      } else errors.push("Invalid date");
    } else {
      bookedAt = d.toISOString();
    }
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
