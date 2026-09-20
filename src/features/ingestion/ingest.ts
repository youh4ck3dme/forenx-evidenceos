import { sha256Hex } from '@/lib/hash/sha256'
import { writeEvidenceBlob } from '@/lib/storage/opfs'
import {
  localAuditRepository,
  localEvidenceRepository,
  localExtractionRepository,
} from '@/lib/storage/repositories'
import type {
  EvidenceItem,
  EvidenceSection,
  ExtractionRecord,
} from '@/lib/storage/types'
import { createId } from '@/lib/utils/cn'
import { extractContent } from '@/lib/parsers'
import { normalizeImageToPng, parseRtfToText } from '@/lib/parsers/normalize'
import { detectFormat, getExtension } from './formatRegistry'

export interface IngestResult {
  evidence: EvidenceItem
  extraction?: ExtractionRecord
}

export async function ingestFiles(
  files: FileList | File[],
  opts: {
    caseId: string
    workspaceId: string
  },
): Promise<IngestResult[]> {
  const results: IngestResult[] = []
  for (const file of Array.from(files)) {
    results.push(await ingestOne(file, opts))
  }
  return results
}

async function ingestOne(
  file: File,
  opts: { caseId: string; workspaceId: string },
): Promise<IngestResult> {
  const detection = await detectFormat(file)
  const evidenceId = createId('ev')
  const extension = getExtension(file.name) || '.bin'
  const importedAt = new Date().toISOString()

  const originalStoragePath = await writeEvidenceBlob(
    opts.caseId,
    'originals',
    `${evidenceId}__${file.name}`,
    file,
  )

  const hash = await sha256Hex(file)

  await localAuditRepository.append({
    id: createId('audit'),
    caseId: opts.caseId,
    workspaceId: opts.workspaceId,
    type: 'EVIDENCE_IMPORTED',
    createdAt: importedAt,
    message: `Imported ${file.name}`,
    meta: {
      evidenceId,
      byteSize: file.size,
      detectedMime: detection.detectedMime,
      route: detection.route,
    },
  })

  await localAuditRepository.append({
    id: createId('audit'),
    caseId: opts.caseId,
    workspaceId: opts.workspaceId,
    type: 'EVIDENCE_HASHED',
    createdAt: new Date().toISOString(),
    message: `SHA-256 computed for ${file.name}`,
    meta: { evidenceId, sha256: hash },
  })

  let status: EvidenceItem['status'] =
    detection.route === 'QUARANTINE' ? 'QUARANTINED' : 'HASHED'
  let quarantineReason = detection.quarantineReason
  let normalizedPath: string | undefined

  if (detection.route === 'NORMALIZE' && detection.format) {
    try {
      if (detection.format.normalizeTo === 'png') {
        const png = await normalizeImageToPng(file)
        normalizedPath = await writeEvidenceBlob(
          opts.caseId,
          'normalized',
          `${evidenceId}.png`,
          png,
        )
      } else if (detection.format.normalizeTo === 'text') {
        const text = await parseRtfToText(file)
        normalizedPath = await writeEvidenceBlob(
          opts.caseId,
          'normalized',
          `${evidenceId}.txt`,
          new Blob([text], { type: 'text/plain' }),
        )
      }
    } catch (error) {
      status = 'QUARANTINED'
      quarantineReason =
        error instanceof Error ? error.message : 'Normalization failed'
    }
  }

  const evidence: EvidenceItem = {
    id: evidenceId,
    caseId: opts.caseId,
    workspaceId: opts.workspaceId,
    originalName: file.name,
    extension,
    mime: file.type || detection.detectedMime,
    detectedMime: detection.detectedMime,
    byteSize: file.size,
    sha256: hash,
    importedAt,
    originalLastModified: file.lastModified
      ? new Date(file.lastModified).toISOString()
      : null,
    storagePath: originalStoragePath,
    normalizedPath,
    status,
    section: guessSection(detection.format?.category),
    ingestRoute:
      detection.route === 'QUARANTINE' ? 'QUARANTINE' : detection.route,
    quarantineReason,
    tags: [],
    classification: 'INTERNAL',
  }

  await localEvidenceRepository.put(evidence)

  let extraction: ExtractionRecord | undefined
  if (evidence.status !== 'QUARANTINED') {
    try {
      const extracted = await extractContent(file, detection.format?.id)
      extraction = {
        id: createId('ex'),
        caseId: opts.caseId,
        evidenceId,
        text: extracted.text,
        pageCount: extracted.pageCount,
        languageHints: extracted.languageHints,
        structured: extracted.structured,
        ocrConfidence: extracted.ocrConfidence,
        createdAt: new Date().toISOString(),
        processor: extracted.processor,
        processorVersion: extracted.processorVersion,
        source: 'extraction',
        derivedFrom: evidenceId,
      }
      await localExtractionRepository.put(extraction)
      evidence.status = 'EXTRACTED'
      evidence.extractionId = extraction.id
      await localEvidenceRepository.put(evidence)

      await localAuditRepository.append({
        id: createId('audit'),
        caseId: opts.caseId,
        workspaceId: opts.workspaceId,
        type: 'EXTRACTION_CREATED',
        createdAt: new Date().toISOString(),
        message: `Extraction created for ${file.name}`,
        meta: { evidenceId, extractionId: extraction.id },
      })
    } catch (error) {
      console.warn('Extraction failed', error)
    }
  }

  return { evidence, extraction }
}

function guessSection(category: string | undefined): EvidenceSection {
  switch (category) {
    case 'image':
      return 'MEDIA'
    case 'data':
      return 'TECHNICAL'
    default:
      return 'OTHER'
  }
}
