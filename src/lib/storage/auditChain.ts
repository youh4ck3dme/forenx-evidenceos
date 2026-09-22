import type { AuditEventRecord } from "@/domain/types";
import { sha256Hex } from "@/lib/hash/sha256";
import { localAuditRepository } from "./repositories";

function canonicalPayload(event: Omit<AuditEventRecord, "eventHash">): string {
  return JSON.stringify({
    id: event.id,
    caseId: event.caseId,
    type: event.type,
    createdAt: event.createdAt,
    message: event.message,
    meta: event.meta ?? null,
    prevHash: event.prevHash ?? null,
  });
}

/** Append an audit event with a prevHash → eventHash chain for local integrity. */
export async function appendAuditChained(
  partial: Omit<AuditEventRecord, "prevHash" | "eventHash">,
): Promise<AuditEventRecord> {
  const existing = partial.caseId ? await localAuditRepository.listByCase(partial.caseId) : [];
  const tip = existing[0];
  const prevHash = tip?.eventHash ?? tip?.id ?? "GENESIS";
  const withPrev: Omit<AuditEventRecord, "eventHash"> = { ...partial, prevHash };
  const eventHash = await sha256Hex(new TextEncoder().encode(canonicalPayload(withPrev)));
  const event: AuditEventRecord = { ...withPrev, eventHash };
  await localAuditRepository.append(event);
  // Browser UI refresh only. Node tests may polyfill indexedDB; they have no document.
  if (partial.caseId && typeof document !== "undefined" && typeof indexedDB !== "undefined") {
    const { useWorkspace } = await import("@/features/workspace/store");
    void useWorkspace.getState().refreshAudit();
  }
  return event;
}
