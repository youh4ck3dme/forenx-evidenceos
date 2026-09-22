import assert from "node:assert/strict";
import test from "node:test";
import { detectFile, fileExtension, looksLikeText } from "./detect.ts";

test("fileExtension handles paths and case", () => {
  assert.equal(fileExtension("report.PDF"), "pdf");
  assert.equal(fileExtension("/tmp/a.b/photo.JPEG"), "jpeg");
  assert.equal(fileExtension("noext"), "");
});

test("PDF magic is native when extension matches", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
  const r = detectFile(bytes, "spis.pdf", "application/pdf");
  assert.equal(r.kind, "pdf");
  assert.equal(r.lane, "NATIVE");
  assert.equal(r.detectedMime, "application/pdf");
});

test("PDF magic with image extension is quarantined", () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 fake");
  const r = detectFile(bytes, "foto.jpg", "image/jpeg");
  assert.equal(r.lane, "QUARANTINE");
  assert.ok(r.quarantineReason?.includes("PDF"));
});

test("JPEG magic with pdf extension is quarantined", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const r = detectFile(bytes, "scan.pdf", "application/pdf");
  assert.equal(r.lane, "QUARANTINE");
  assert.ok(r.quarantineReason?.includes("obrázok") || r.quarantineReason?.includes("pdf"));
});

test("PNG signature is native", () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const r = detectFile(bytes, "x.png", "image/png");
  assert.equal(r.kind, "image");
  assert.equal(r.lane, "NATIVE");
  assert.equal(r.detectedMime, "image/png");
});

test("PE MZ executable is quarantined", () => {
  const bytes = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
  const r = detectFile(bytes, "tool.exe", "application/octet-stream");
  assert.equal(r.lane, "QUARANTINE");
  assert.equal(r.kind, "executable");
});

test("ZIP without docx extension is quarantined", () => {
  const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const r = detectFile(bytes, "archive.zip", "application/zip");
  assert.equal(r.lane, "QUARANTINE");
});

test("plain text looksLikeText", () => {
  assert.equal(looksLikeText(new TextEncoder().encode("ahoj svet\n")), true);
  assert.equal(looksLikeText(Uint8Array.from([0, 1, 2, 3, 4])), false);
});
