import type { DetectedKind, IngestLane } from "@/domain/types";

export interface DetectionResult {
  kind: DetectedKind;
  detectedMime: string;
  lane: IngestLane;
  quarantineReason?: string;
  previewKind: "pdf" | "image" | "text" | "markdown" | "metadata";
}

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "json", "xml", "html", "htm", "rtf"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "jpe", "webp", "heic", "heif", "avif", "gif", "bmp"]);
const PDF_EXT = new Set(["pdf"]);

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** Magic-byte identity disagrees with a strong extension claim → quarantine. */
function mismatchQuarantine(
  magicLabel: string,
  ext: string,
  mime: string,
  kind: DetectedKind,
): DetectionResult | null {
  if (!ext) return null;
  if (magicLabel === "pdf" && IMAGE_EXT.has(ext)) {
    return quarantined(
      mime,
      kind,
      `Podpis je PDF (%PDF), prípona .${ext} tvrdí iný typ. Originál je uložený, súbor sa neextrahuje.`,
    );
  }
  if (magicLabel === "image" && PDF_EXT.has(ext)) {
    return quarantined(
      mime,
      kind,
      `Podpis je obrázok, prípona .pdf tvrdí dokument. Originál je uložený, súbor sa neextrahuje.`,
    );
  }
  if (magicLabel === "pdf" && TEXT_EXT.has(ext) && ext !== "") {
    return quarantined(
      mime,
      kind,
      `Podpis je PDF, prípona .${ext} tvrdí text. Originál je uložený, súbor sa neextrahuje.`,
    );
  }
  return null;
}

export function detectFile(bytes: Uint8Array, filename: string, declaredMime: string): DetectionResult {
  const ext = fileExtension(filename);
  const head = bytes.subarray(0, Math.min(bytes.length, 96));
  const asAscii = asciiAt(head, 0, Math.min(head.length, 64));

  if (startsWith(head, [0x4d, 0x5a])) {
    return quarantined(
      "application/x-msdownload",
      "executable",
      "Podpis spustiteľného súboru PE/DOS (MZ). Originál je uložený, súbor sa nespúšťa.",
    );
  }
  if (startsWith(head, [0x7f, 0x45, 0x4c, 0x46])) {
    return quarantined(
      "application/x-elf",
      "executable",
      "Podpis spustiteľného súboru ELF. Originál je uložený, súbor sa nespúšťa.",
    );
  }
  if (
    startsWith(head, [0xca, 0xfe, 0xba, 0xbe]) ||
    startsWith(head, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(head, [0xfe, 0xed, 0xfa, 0xce])
  ) {
    return quarantined(
      "application/x-mach-binary",
      "executable",
      "Podpis spustiteľného súboru Mach-O. Originál je uložený, súbor sa nespúšťa.",
    );
  }

  if (asAscii.startsWith("%PDF")) {
    const bad = mismatchQuarantine("pdf", ext, "application/pdf", "pdf");
    if (bad) return bad;
    return native("pdf", "application/pdf", "pdf");
  }
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const bad = mismatchQuarantine("image", ext, "image/png", "image");
    if (bad) return bad;
    return native("image", "image/png", "image");
  }
  if (startsWith(head, [0xff, 0xd8, 0xff])) {
    const bad = mismatchQuarantine("image", ext, "image/jpeg", "image");
    if (bad) return bad;
    return native("image", "image/jpeg", "image");
  }
  if (asAscii.startsWith("RIFF") && asciiAt(head, 8, 4) === "WEBP") {
    const bad = mismatchQuarantine("image", ext, "image/webp", "image");
    if (bad) return bad;
    return native("image", "image/webp", "image");
  }
  if (asAscii.startsWith("GIF8")) {
    const bad = mismatchQuarantine("image", ext, "image/gif", "image");
    if (bad) return bad;
    return native("image", "image/gif", "image");
  }

  const ftyp = asciiAt(head, 4, 8);
  if (ftyp.startsWith("ftyp")) {
    const brand = asciiAt(head, 8, 4).toLowerCase();
    if (brand === "avif" || brand === "avis") {
      return { kind: "image", detectedMime: "image/avif", lane: "NORMALIZE", previewKind: "image" };
    }
    if (["heic", "heif", "mif1", "msf1", "heix"].includes(brand)) {
      return { kind: "image", detectedMime: "image/heic", lane: "NORMALIZE", previewKind: "image" };
    }
  }

  if (asAscii.startsWith("{\\rtf")) {
    return { kind: "rtf", detectedMime: "application/rtf", lane: "NORMALIZE", previewKind: "text" };
  }

  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])) {
    if (ext === "docx" || declaredMime.includes("wordprocessingml")) {
      return native(
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "metadata",
      );
    }
    return quarantined(
      "application/zip",
      "unknown",
      "ZIP archív bez podporovaného typu dokumentu. Originál je uložený v nezmenenej podobe.",
    );
  }

  const trimmed = asAscii.trimStart();
  if (ext === "html" || ext === "htm" || /^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return native("html", "text/html", "text");
  }
  if (ext === "xml" || trimmed.startsWith("<?xml") || /^<[a-zA-Z][\w:-]*[\s>]/.test(trimmed)) {
    if (ext === "xml") return native("xml", "application/xml", "text");
  }
  if (ext === "json" || ((trimmed.startsWith("{") || trimmed.startsWith("[")) && looksLikeText(bytes))) {
    if (ext === "json" || looksLikeJson(trimmed)) return native("json", "application/json", "text");
  }
  if (ext === "md" || ext === "markdown") {
    return native("markdown", "text/markdown", "markdown");
  }
  if (ext === "csv") {
    return native("csv", "text/csv", "text");
  }
  if (ext === "txt" || (TEXT_EXT.has(ext) && looksLikeText(bytes))) {
    return native("text", "text/plain", "text");
  }

  if (looksLikeText(bytes) && (declaredMime.startsWith("text/") || TEXT_EXT.has(ext))) {
    return native(
      ext === "md" ? "markdown" : "text",
      declaredMime || "text/plain",
      ext === "md" ? "markdown" : "text",
    );
  }

  if (IMAGE_EXT.has(ext) && declaredMime.startsWith("image/")) {
    return { kind: "image", detectedMime: declaredMime, lane: "NORMALIZE", previewKind: "image" };
  }

  if (!looksLikeText(bytes)) {
    return quarantined(
      declaredMime || "application/octet-stream",
      "unknown",
      "Nerozpoznaný binárny podpis. Originál je uložený v nezmenenej podobe a nespracúva sa.",
    );
  }

  return native("text", "text/plain", "text");
}

function native(
  kind: DetectedKind,
  mime: string,
  previewKind: DetectionResult["previewKind"],
): DetectionResult {
  return { kind, detectedMime: mime, lane: "NATIVE", previewKind };
}

function quarantined(mime: string, kind: DetectedKind, reason: string): DetectionResult {
  return {
    kind,
    detectedMime: mime,
    lane: "QUARANTINE",
    quarantineReason: reason,
    previewKind: "metadata",
  };
}

function looksLikeJson(text: string): boolean {
  try {
    JSON.parse(text.slice(0, Math.min(text.length, 2000)));
    return true;
  } catch {
    return text.startsWith("{") || text.startsWith("[");
  }
}

export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const c = sample[i]!;
    if (c === 0) return false;
    if (c < 8 || (c > 13 && c < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.05;
}
