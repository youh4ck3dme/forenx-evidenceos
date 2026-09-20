import { Drawer } from '@/components/ui/drawer'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { formatDateTime } from '@/lib/utils/cn'

export function AuditDrawer() {
  const open = useWorkspaceStore((s) => s.auditOpen)
  const setAuditOpen = useWorkspaceStore((s) => s.setAuditOpen)
  const auditEvents = useWorkspaceStore((s) => s.auditEvents)

  return (
    <Drawer open={open} onOpenChange={setAuditOpen} title="Audit log">
      <p className="mb-4 text-xs text-fx-dim">
        Append-only local audit trail for this case. Events never overwrite prior
        entries.
      </p>
      <ul className="space-y-3">
        {auditEvents.map((event) => (
          <li key={event.id} className="border-l-2 border-fx-border pl-3">
            <div className="font-mono text-[10px] tracking-wider text-fx-accent uppercase">
              {event.type}
            </div>
            <div className="text-sm text-fx-text">{event.message}</div>
            <div className="font-mono text-[10px] text-fx-dim">
              {formatDateTime(event.createdAt)}
            </div>
          </li>
        ))}
        {!auditEvents.length && (
          <p className="text-sm text-fx-dim">No audit events yet.</p>
        )}
      </ul>
    </Drawer>
  )
}
