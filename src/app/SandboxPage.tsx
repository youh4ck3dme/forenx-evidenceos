import { useEffect, useRef } from 'react'
import { CaseSidebar } from '@/features/cases/CaseSidebar'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { EvidenceViewer } from '@/features/viewer/EvidenceViewer'
import { AiAnalystPanel } from '@/features/ai/AiAnalystPanel'
import { StatusBar } from '@/features/audit/StatusBar'
import { AuditDrawer } from '@/features/audit/AuditDrawer'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { MalteWorkspace } from '@/features/malte/MalteWorkspace'
import { localAuditRepository } from '@/lib/storage/repositories'
import { createId } from '@/lib/utils/cn'
import { Drawer } from '@/components/ui/drawer'
import { useLocale } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function SandboxPage() {
  const ready = useWorkspaceStore((s) => s.ready)
  const init = useWorkspaceStore((s) => s.init)
  const evidence = useWorkspaceStore((s) => s.evidence)
  const selectedEvidenceIds = useWorkspaceStore((s) => s.selectedEvidenceIds)
  const importEvidence = useWorkspaceStore((s) => s.importEvidence)
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const createCase = useWorkspaceStore((s) => s.createCase)
  const activeCaseId = useWorkspaceStore((s) => s.activeCaseId)
  const cases = useWorkspaceStore((s) => s.cases)
  const mobilePanel = useWorkspaceStore((s) => s.mobilePanel)
  const setMobilePanel = useWorkspaceStore((s) => s.setMobilePanel)
  const workspaceMode = useWorkspaceStore((s) => s.workspaceMode)
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useLocale()

  useEffect(() => {
    if (!ready) void init()
  }, [ready, init])

  useEffect(() => {
    if (!ready) return
    if (!activeCaseId && cases.length === 0) {
      void createCase({
        name: t('sandbox.caseName'),
        description: t('sandbox.caseDescription'),
      })
    }
  }, [ready, activeCaseId, cases.length, createCase, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  // Offline flag only — no automatic /api/ai traffic
  useEffect(() => {
    const onOffline = () => {
      useWorkspaceStore.setState({ aiStatus: 'OFFLINE' })
    }
    const onOnline = () => {
      useWorkspaceStore.setState((s) =>
        s.aiStatus === 'OFFLINE' ? { aiStatus: 'IDLE' } : s,
      )
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const selected =
    evidence.find((e) => e.id === selectedEvidenceIds[0]) ?? null

  useEffect(() => {
    if (!selected || !activeCaseId) return
    const workspaceId = useWorkspaceStore.getState().workspaceId
    void localAuditRepository.append({
      id: createId('audit'),
      caseId: activeCaseId,
      workspaceId,
      type: 'EVIDENCE_SELECTED',
      createdAt: new Date().toISOString(),
      message: t('status.selected', { name: selected.originalName }),
      meta: { evidenceId: selected.id },
    })
  }, [selected?.id, activeCaseId, selected?.originalName])

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-fx-bg font-mono text-xs tracking-[0.2em] text-fx-dim uppercase">
        {t('sandbox.initializing')}
      </div>
    )
  }

  return (
    <div className="fx-shell flex flex-col bg-fx-bg">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[260px] shrink-0 overflow-hidden border-r border-fx-border lg:block">
          <CaseSidebar />
        </aside>
        {workspaceMode === 'malte' && activeCaseId ? (
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <MalteWorkspace caseId={activeCaseId} workspaceId={workspaceId} />
          </main>
        ) : (
          <>
            <main className="min-h-0 min-w-0 flex-1 overflow-hidden border-r border-fx-border">
              <EvidenceViewer
                evidence={selected}
                onDropFiles={(files) => void importEvidence(files)}
              />
            </main>
            <aside className="hidden h-full w-[300px] shrink-0 overflow-hidden xl:block">
              <AiAnalystPanel />
            </aside>
          </>
        )}
      </div>

      <StatusBar onAddEvidence={() => fileInputRef.current?.click()} />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.jpe,.webp,.heic,.heif,.avif,.docx,.rtf,.md,.txt,.csv,.json,.xml,.html,.htm,.xlsx,.xls"
        onChange={(e) => {
          if (e.target.files?.length) void importEvidence(e.target.files)
          e.target.value = ''
        }}
      />

      <CommandPalette fileInputRef={fileInputRef} />
      <AuditDrawer />

      <Drawer
        open={mobilePanel === 'cases'}
        onOpenChange={(open) => setMobilePanel(open ? 'cases' : 'none')}
        title={t('sandbox.drawer.cases')}
        side="left"
      >
        <div className="mb-3 flex justify-end px-1">
          <LanguageSwitcher />
        </div>
        <div className="h-[75dvh]">
          <CaseSidebar />
        </div>
      </Drawer>
      <Drawer
        open={mobilePanel === 'ai'}
        onOpenChange={(open) => setMobilePanel(open ? 'ai' : 'none')}
        title={t('sandbox.drawer.ai')}
        side="right"
      >
        <div className="mb-3 flex justify-end px-1">
          <LanguageSwitcher />
        </div>
        <div className="h-[75dvh]">
          {workspaceMode === 'malte' && activeCaseId ? (
            <MalteWorkspace caseId={activeCaseId} workspaceId={workspaceId} />
          ) : (
            <AiAnalystPanel />
          )}
        </div>
      </Drawer>
    </div>
  )
}
