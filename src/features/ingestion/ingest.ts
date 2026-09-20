import type { EvidenceRecord, ExtractionRecord } from "@/domain/types";
import { createId } from "@/lib/ids";
import { sha256Hex } from "@/lib/hash/sha256";
import { detectFile, fileExtension } from "@/lib/parsers/detect";
import { extractEvidence } from "@/lib/parsers/extract";
import { writeOriginal } from "@/lib/storage/files";

export interface IngestResult {
  evidence: EvidenceRecord;
  extraction: ExtractionRecord | null;
}

export async function ingestFile(
  file: File,
  caseId: string,
  existingHashes: Map<string, string>,
): Promise<IngestResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sha256 = await sha256Hex(bytes);
  const detection = detectFile(bytes, file.name, file.type || "");
  const id = createId("ev");
  const extension = fileExtension(file.name);
  const storagePath = await writeOriginal(caseId, id, file);
  const duplicateOf = existingHashes.get(sha256);
  const quarantined = detection.lane === "QUARANTINE";

  const evidence: EvidenceRecord = {
    id,
    caseId,
    originalName: file.name,
    extension,
    mime: file.type || "application/octet-stream",
    detectedMime: detection.detectedMime,
    detectedKind: detection.kind,
    byteSize: file.size,
    sha256,
    importedAt: new Date().toISOString(),
    originalLastModified: Number.isFinite(file.lastModified) ? new Date(file.lastModified).toISOString() : null,
    storagePath,
    status: quarantined ? "QUARANTINED" : "HASHED",
    section: detection.kind === "image" ? "MEDIA" : "OTHER",
    sectionSource: "DEFAULT",
    ingestLane: detection.lane,
    quarantineReason: detection.quarantineReason,
    duplicateOf,
    previewKind: detection.previewKind,
  };

  if (quarantined) {
    return { evidence, extraction: null };
  }

  const extraction = await extractEvidence({
    caseId,
    evidenceId: id,
    filename: file.name,
    kind: detection.kind,
    mime: detection.detectedMime,
    bytes,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
  });
  evidence.status = "EXTRACTED";
  evidence.extractionId = extraction.id;
  return { evidence, extraction };
}
