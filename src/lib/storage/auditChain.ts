import { sha256Hex } from '@/lib/hash/sha256'
import type { AuditEvent } from './types'
import { localAuditRepository } from './repositories'

function canonicalPayload(event: Omit<AuditEvent, 'eventHash'>): string {
  return JSON.stringify({
    id: event.id,
    caseId: event.caseId,
    type: event.type,
    createdAt: event.createdAt,
    message: event.message,
    meta: event.meta ?? null,
    prevHash: event.prevHash ?? null,
  })
}

/** Append audit event with prevHash → eventHash chain for local integrity. */
export async function appendAuditChained(
  partial: Omit<AuditEvent, 'prevHash' | 'eventHash'>,
): Promise<AuditEvent> {
  const existing = await localAuditRepository.listByCase(partial.caseId)
  const tip = existing[0] // list is newest-first
  const prevHash = tip?.eventHash ?? tip?.id ?? 'GENESIS'
  const withPrev: Omit<AuditEvent, 'eventHash'> = { ...partial, prevHash }
  const eventHash = await sha256Hex(
    new TextEncoder().encode(canonicalPayload(withPrev)),
  )
  const event: AuditEvent = { ...withPrev, eventHash }
  await localAuditRepository.append(event)
  return event
}
