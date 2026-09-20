import {
  localAuditRepository,
  localCaseRepository,
  localEntityRepository,
  localEvidenceRepository,
  localFindingRepository,
  localTimelineRepository,
} from '@/lib/storage/repositories'
import { createId, downloadText, formatDateTime } from '@/lib/utils/cn'
import { writeEvidenceBlob } from '@/lib/storage/opfs'

export async function exportCaseJson(caseId: string): Promise<void> {
  const payload = await buildExportPayload(caseId)
  const text = JSON.stringify(payload, null, 2)
  downloadText(
    `${payload.case.reference || caseId}-export.json`,
    text,
    'application/json',
  )
  await persistExport(caseId, payload.case.workspaceId, 'json', text)
}

export async function exportCaseMarkdown(caseId: string): Promise<void> {
  const payload = await buildExportPayload(caseId)
  const md = toMarkdown(payload)
  downloadText(
    `${payload.case.reference || caseId}-export.md`,
    md,
    'text/markdown',
  )
  await persistExport(caseId, payload.case.workspaceId, 'md', md)
}

async function persistExport(
  caseId: string,
  workspaceId: string,
  ext: string,
  content: string,
) {
  await writeEvidenceBlob(
    caseId,
    'exports',
    `export-${Date.now()}.${ext}`,
    new Blob([content], {
      type: ext === 'json' ? 'application/json' : 'text/markdown',
    }),
  )
  await localAuditRepository.append({
    id: createId('audit'),
    caseId,
    workspaceId,
    type: 'EXPORT_CREATED',
    createdAt: new Date().toISOString(),
    message: `Exported case as ${ext.toUpperCase()}`,
  })
}

async function buildExportPayload(caseId: string) {
  const caseRecord = await localCaseRepository.get(caseId)
  if (!caseRecord) throw new Error('Case not found')
  const [evidence, findings, entities, timelineEvents, auditEvents] =
    await Promise.all([
      localEvidenceRepository.listByCase(caseId),
      localFindingRepository.listByCase(caseId),
      localEntityRepository.listByCase(caseId),
      localTimelineRepository.listByCase(caseId),
      localAuditRepository.listByCase(caseId),
    ])
  return {
    exportedAt: new Date().toISOString(),
    product: 'ForenX EvidenceOS',
    version: '0.1.0',
    case: caseRecord,
    evidence,
    findings,
    entities,
    timelineEvents,
    auditEvents,
  }
}

function toMarkdown(
  payload: Awaited<ReturnType<typeof buildExportPayload>>,
): string {
  const lines: string[] = [
    `# ForenX Case Export — ${payload.case.reference}`,
    '',
    `- Name: ${payload.case.name}`,
    `- Classification: ${payload.case.classification}`,
    `- Exported: ${formatDateTime(payload.exportedAt)}`,
    '',
    '## Evidence inventory',
    '',
  ]
  for (const item of payload.evidence) {
    lines.push(
      `- **${item.originalName}** — SHA-256 \`${item.sha256}\` — ${item.byteSize} bytes — ${item.status}`,
    )
  }
  lines.push('', '## Findings', '')
  for (const f of payload.findings) {
    lines.push(
      `- (${f.epistemicClass}, conf=${f.confidence}) ${f.statement} — action=${f.actionId}, model=${f.model}, prompt=${f.promptVersion}`,
    )
  }
  lines.push('', '## Entities', '')
  for (const e of payload.entities) {
    lines.push(`- [${e.entityType}] ${e.canonicalValue}`)
  }
  lines.push('', '## Timeline', '')
  for (const t of payload.timelineEvents) {
    lines.push(`- ${t.timestampOriginal} — ${t.action || t.eventType}`)
  }
  lines.push('', '## Audit', '')
  for (const a of payload.auditEvents) {
    lines.push(`- ${a.createdAt} ${a.type}: ${a.message}`)
  }
  lines.push('')
  return lines.join('\n')
}
