import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  FilePlus2,
  Command,
  ScrollText,
  Download,
  Palette,
} from 'lucide-react'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { formatBytes, truncateHash, cn } from '@/lib/utils/cn'
import { exportCaseJson, exportCaseMarkdown } from '@/features/export/exportCase'
import { useLocale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

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
  const aiStatus = useWorkspaceStore((s) => s.aiStatus)
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const setAuditOpen = useWorkspaceStore((s) => s.setAuditOpen)
  const refreshCaseData = useWorkspaceStore((s) => s.refreshCaseData)
  const setMobilePanel = useWorkspaceStore((s) => s.setMobilePanel)
  const { t } = useLocale()
  const { theme, setTheme } = useTheme()
  const [exportOpen, setExportOpen] = useState(false)
  const exportWrapRef = useRef<HTMLDivElement>(null)
  const exportMenuId = useId()

  const selected = evidence.find((e) => e.id === selectedEvidenceIds[0])
  const usageRatio = storageQuota > 0 ? storageUsage / storageQuota : 0
  const storageWarn = usageRatio > 0.8
  const storageLabel = `${formatBytes(storageUsage)}${storageQuota ? ` / ${formatBytes(storageQuota)}` : ''}`
  const hashShort = selected ? truncateHash(selected.sha256) : '—'

  useEffect(() => {
    if (!exportOpen) return
    function onDoc(event: MouseEvent) {
      if (!exportWrapRef.current?.contains(event.target as Node)) {
        setExportOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setExportOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [exportOpen])

  async function runExport(kind: 'json' | 'md') {
    if (!activeCaseId) return
    setExportOpen(false)
    if (kind === 'json') await exportCaseJson(activeCaseId)
    else await exportCaseMarkdown(activeCaseId)
    await refreshCaseData()
  }

  return (
    <footer
      className="fx-glass shrink-0 border-t border-fx-border pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      role="contentinfo"
    >
      {/* Telemetry strip — never steals primary tap targets */}
      <div className="flex h-5 items-center justify-center gap-2 overflow-hidden px-2 font-mono text-[10px] leading-none text-fx-dim">
        <button
          type="button"
          className="min-h-5 lg:hidden px-1 text-fx-muted hover:text-fx-text"
          onClick={() => setMobilePanel('cases')}
        >
          {t('status.cases')}
        </button>
        <button
          type="button"
          className="min-h-5 lg:hidden px-1 text-fx-muted hover:text-fx-text"
          onClick={() => setMobilePanel('ai')}
        >
          {t('status.ai')}
        </button>
        <span className="truncate" title={selected?.sha256}>
          {t('status.hash', { hash: hashShort })}
        </span>
        <span aria-hidden className="text-fx-border">
          ·
        </span>
        <span className={storageWarn ? 'text-fx-warn' : undefined}>
          {t('status.storage', { usage: storageLabel })}
        </span>
        <span aria-hidden className="text-fx-border">
          ·
        </span>
        <span>{t('status.itemCount', { count: evidence.length })}</span>
        {aiStatus === 'OFFLINE' && (
          <>
            <span aria-hidden className="text-fx-border">
              ·
            </span>
            <span className="tracking-wider text-fx-danger uppercase">
              {t('ai.offlineChip')}
            </span>
          </>
        )}
        {ingestBusy && (
          <>
            <span aria-hidden className="text-fx-border">
              ·
            </span>
            <span className="tracking-wider text-fx-accent uppercase">
              {t('status.ingestBusy')}
            </span>
          </>
        )}
        {statusMessage && (
          <span className="hidden max-w-[140px] truncate text-fx-muted sm:inline">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Centered dock */}
      <nav
        aria-label={t('status.dockLabel')}
        className="mx-auto grid h-16 max-w-3xl grid-cols-5 items-center justify-center gap-1 px-1 md:flex md:h-14 md:justify-center md:gap-2 md:px-3"
      >
        <DockButton
          label={t('status.dock.addEvidence')}
          disabled={ingestBusy}
          onClick={onAddEvidence}
          icon={<FilePlus2 className="h-5 w-5" aria-hidden />}
        />
        <DockButton
          label={t('status.dock.commands')}
          hint={t('status.dock.commandsHint')}
          onClick={() => setCommandOpen(true)}
          icon={<Command className="h-5 w-5" aria-hidden />}
        />
        <DockButton
          label={t('status.dock.audit')}
          badge={auditEvents.length > 0 ? String(auditEvents.length) : undefined}
          onClick={() => setAuditOpen(true)}
          icon={<ScrollText className="h-5 w-5" aria-hidden />}
        />

        <div ref={exportWrapRef} className="relative flex justify-center">
          <DockButton
            label={t('status.dock.export')}
            disabled={!activeCaseId}
            aria-expanded={exportOpen}
            aria-controls={exportMenuId}
            onClick={() => setExportOpen((open) => !open)}
            icon={<Download className="h-5 w-5" aria-hidden />}
          />
          {exportOpen && (
            <div
              id={exportMenuId}
              role="menu"
              className="absolute bottom-[calc(100%+0.35rem)] left-1/2 z-30 w-36 -translate-x-1/2 rounded-sm border border-fx-border bg-fx-panel p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-sm px-3 py-2 text-left text-xs text-fx-text hover:bg-fx-elevated"
                onClick={() => void runExport('json')}
              >
                {t('status.exportJson')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-sm px-3 py-2 text-left text-xs text-fx-text hover:bg-fx-elevated"
                onClick={() => void runExport('md')}
              >
                {t('status.exportMd')}
              </button>
            </div>
          )}
        </div>

        <DockButton
          label={t('status.dock.theme')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          icon={<Palette className="h-5 w-5" aria-hidden />}
        />
      </nav>
    </footer>
  )
}

function DockButton({
  label,
  hint,
  icon,
  onClick,
  disabled,
  badge,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
}: {
  label: string
  hint?: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  badge?: string
  'aria-expanded'?: boolean
  'aria-controls'?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      title={hint ? `${label} (${hint})` : label}
      className={cn(
        'relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm px-1 py-1 text-fx-text',
        'hover:bg-fx-elevated focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fx-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        'md:min-h-11 md:flex-row md:gap-1.5 md:px-3',
      )}
    >
      <span className="relative shrink-0 text-fx-accent">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1 rounded-sm bg-fx-elevated px-1 font-mono text-[9px] text-fx-muted">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-center text-[11px] leading-tight text-fx-muted md:text-xs md:text-fx-text">
        {label}
        {hint ? (
          <span className="ml-1 hidden font-mono text-[10px] text-fx-dim md:inline">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  )
}
