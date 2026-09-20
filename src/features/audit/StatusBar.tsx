import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { Button } from '@/components/ui/button'
import { formatBytes, truncateHash } from '@/lib/utils/cn'
import { exportCaseJson, exportCaseMarkdown } from '@/features/export/exportCase'

export function StatusBar({
  onAddEvidence,
}: {
  onAddEvidence: () => void
}) {
  const evidence = useWorkspaceStore((s) => s.evidence)
  const selectedEvidenceIds = useWorkspaceStore((s) => s.selectedEvidenceIds)
  const auditEvents = useWorkspaceStore((s) => s.auditEvents)
  const storageUsage = useWorkspaceStore((s) => s.storageUsage)
  const storageQuota = useWorkspaceStore((s) => s.storageQuota)
  const statusMessage = useWorkspaceStore((s) => s.statusMessage)
  const ingestBusy = useWorkspaceStore((s) => s.ingestBusy)
  const activeCaseId = useWorkspaceStore((s) => s.activeCaseId)
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const setAuditOpen = useWorkspaceStore((s) => s.setAuditOpen)
  const refreshCaseData = useWorkspaceStore((s) => s.refreshCaseData)
  const setMobilePanel = useWorkspaceStore((s) => s.setMobilePanel)

  const selected = evidence.find((e) => e.id === selectedEvidenceIds[0])
  const usageRatio = storageQuota > 0 ? storageUsage / storageQuota : 0
  const storageWarn = usageRatio > 0.8

  return (
    <div className="fx-glass flex h-11 shrink-0 items-center gap-2 border-t border-fx-border px-2 text-[11px] md:px-3">
      <Button size="sm" onClick={onAddEvidence} disabled={ingestBusy}>
        + Add Evidence
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hidden sm:inline-flex"
        onClick={() => setCommandOpen(true)}
      >
        ⌘K Command
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="lg:hidden"
        onClick={() => setMobilePanel('cases')}
      >
        Cases
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="lg:hidden"
        onClick={() => setMobilePanel('ai')}
      >
        AI
      </Button>

      <div className="mx-1 hidden h-4 w-px bg-fx-border md:block" />

      <button
        type="button"
        className="font-mono text-fx-muted hover:text-fx-text"
        onClick={() => setAuditOpen(true)}
      >
        Audit {auditEvents.length}
      </button>

      <div className="hidden font-mono text-fx-dim md:block">
        Hash {selected ? truncateHash(selected.sha256) : '—'}
      </div>

      <div
        className={`hidden font-mono md:block ${storageWarn ? 'text-fx-warn' : 'text-fx-dim'}`}
      >
        Storage {formatBytes(storageUsage)}
        {storageQuota ? ` / ${formatBytes(storageQuota)}` : ''}
        {storageWarn ? ' — approaching limit' : ''}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {statusMessage && (
          <span className="max-w-[240px] truncate text-fx-muted">{statusMessage}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={!activeCaseId}
          onClick={() => {
            if (!activeCaseId) return
            void exportCaseJson(activeCaseId).then(() => refreshCaseData())
          }}
        >
          JSON
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!activeCaseId}
          onClick={() => {
            if (!activeCaseId) return
            void exportCaseMarkdown(activeCaseId).then(() => refreshCaseData())
          }}
        >
          MD
        </Button>
      </div>
    </div>
  )
}
