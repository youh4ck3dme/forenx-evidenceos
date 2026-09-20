import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { Button } from '@/components/ui/button'
import { formatBytes, truncateHash } from '@/lib/utils/cn'
import { exportCaseJson, exportCaseMarkdown } from '@/features/export/exportCase'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLocale } from '@/lib/i18n'

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
  const { t } = useLocale()

  const selected = evidence.find((e) => e.id === selectedEvidenceIds[0])
  const usageRatio = storageQuota > 0 ? storageUsage / storageQuota : 0
  const storageWarn = usageRatio > 0.8
  const storageLabel = `${formatBytes(storageUsage)}${storageQuota ? ` / ${formatBytes(storageQuota)}` : ''}`

  return (
    <div className="fx-glass flex h-11 shrink-0 items-center gap-2 border-t border-fx-border px-2 text-[11px] md:px-3">
      <Button size="sm" onClick={onAddEvidence} disabled={ingestBusy}>
        {t('status.addEvidence')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="hidden sm:inline-flex"
        onClick={() => setCommandOpen(true)}
      >
        {t('status.command')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="lg:hidden"
        onClick={() => setMobilePanel('cases')}
      >
        {t('status.cases')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="lg:hidden"
        onClick={() => setMobilePanel('ai')}
      >
        {t('status.ai')}
      </Button>

      <div className="mx-1 hidden h-4 w-px bg-fx-border md:block" />

      <button
        type="button"
        className="font-mono text-fx-muted hover:text-fx-text"
        onClick={() => setAuditOpen(true)}
      >
        {t('status.audit', { count: auditEvents.length })}
      </button>

      <div className="hidden font-mono text-fx-dim md:block">
        {t('status.hash', {
          hash: selected ? truncateHash(selected.sha256) : '—',
        })}
      </div>

      <div
        className={`hidden font-mono md:block ${storageWarn ? 'text-fx-warn' : 'text-fx-dim'}`}
        title={storageWarn ? t('status.storageNearLimit') : undefined}
      >
        {t('status.storage', { usage: storageLabel })}
        {storageWarn ? t('status.storageWarn') : ''}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher className="mr-1" />
        {statusMessage && (
          <span className="max-w-[200px] truncate text-fx-muted">{statusMessage}</span>
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
          {t('status.exportJson')}
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
          {t('status.exportMd')}
        </Button>
      </div>
    </div>
  )
}
