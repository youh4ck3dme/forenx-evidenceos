import type { DetectedKind, ExtractionRecord } from "@/domain/types";
import { createId } from "@/lib/ids";
import { capText, countWords, decodeText, stripRtf } from "@/lib/security/text";

const PROCESSOR_VERSION = "0.1.0";

export interface ExtractInput {
  caseId: string;
  evidenceId: string;
  filename: string;
  kind: DetectedKind;
  mime: string;
  bytes: Uint8Array;
  lastModified: number | null;
}

export async function extractEvidence(input: ExtractInput): Promise<ExtractionRecord> {
  const metadata: ExtractionRecord["metadata"] = {
    originalName: input.filename,
    declaredMime: input.mime,
    byteLength: input.bytes.byteLength,
    originalLastModified: input.lastModified,
  };

  let raw = "";
  let processor = "text-decoder";
  let pageCount: number | undefined;

  try {
    switch (input.kind) {
      case "pdf": {
        const pdf = await extractPdf(input.bytes);
        raw = pdf.text;
        pageCount = pdf.pageCount;
        processor = "pdfjs";
        metadata.pageCount = pdf.pageCount;
        break;
      }
      case "docx": {
        raw = await extractDocx(input.bytes);
        processor = "mammoth";
        break;
      }
      case "rtf":
        raw = stripRtf(decodeText(input.bytes));
        processor = "rtf-strip";
        break;
      case "html":
        raw = stripTags(decodeText(input.bytes));
        processor = "html-text";
        break;
      case "image": {
        const dims = await imageDimensions(input.bytes, input.mime);
        if (dims) {
          metadata.width = dims.width;
          metadata.height = dims.height;
        }
        processor = "image-metadata";
        raw = "";
        break;
      }
      case "json":
      case "xml":
      case "csv":
      case "markdown":
      case "text":
        raw = decodeText(input.bytes);
        break;
      default:
        if (input.kind !== "unknown" && input.kind !== "executable") {
          raw = decodeText(input.bytes);
        }
        processor = "none";
    }
  } catch (err) {
    metadata.extractError = err instanceof Error ? err.message : "extraction_failed";
    processor = `${processor}:failed`;
  }

  const capped = capText(raw);
  return {
    id: createId("ex"),
    caseId: input.caseId,
    evidenceId: input.evidenceId,
    createdAt: new Date().toISOString(),
    processor,
    processorVersion: PROCESSOR_VERSION,
    text: capped.text,
    pageCount,
    wordCount: countWords(capped.text),
    truncated: capped.truncated,
    metadata,
    source: "ORIGINAL",
    derivedFrom: input.evidenceId,
  };
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const doc = await pdfjs.getDocument({ data: copy, disableAutoFetch: true }).promise;
  const pageCount = doc.numPages;
  const parts: string[] = [];
  const limit = Math.min(pageCount, 40);
  for (let i = 1; i <= limit; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(`-- page ${i} --\n${line}`);
  }
  if (pageCount > limit) {
    parts.push(`[truncated: ${pageCount - limit} additional pages not extracted]`);
  }
  return { text: parts.join("\n\n"), pageCount };
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const result = await mammoth.extractRawText({ arrayBuffer: copy.buffer as ArrayBuffer });
  return result.value ?? "";
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function imageDimensions(
  bytes: Uint8Array,
  mime: string,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const blob = new Blob([uint8ToBuffer(bytes)], { type: mime || "application/octet-stream" });
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

function uint8ToBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}
