import { useEffect, useRef } from 'react'
import { CaseSidebar } from '@/features/cases/CaseSidebar'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { EvidenceViewer } from '@/features/viewer/EvidenceViewer'
import { AiAnalystPanel } from '@/features/ai/AiAnalystPanel'
import { StatusBar } from '@/features/audit/StatusBar'
import { AuditDrawer } from '@/features/audit/AuditDrawer'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { localAuditRepository } from '@/lib/storage/repositories'
import { createId } from '@/lib/utils/cn'
import { Drawer } from '@/components/ui/drawer'

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
  const refreshAiStatus = useWorkspaceStore((s) => s.refreshAiStatus)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ready) void init()
  }, [ready, init])

  useEffect(() => {
    if (!ready) return
    if (!activeCaseId && cases.length === 0) {
      void createCase({ name: 'Sandbox Case', description: 'Local forensic sandbox' })
    }
  }, [ready, activeCaseId, cases.length, createCase])

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

  useEffect(() => {
    void refreshAiStatus()
    const onOnline = () => void refreshAiStatus()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOnline)
    const timer = window.setInterval(() => void refreshAiStatus(), 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOnline)
      window.clearInterval(timer)
    }
  }, [refreshAiStatus])

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
      message: `Selected ${selected.originalName}`,
      meta: { evidenceId: selected.id },
    })
  }, [selected?.id, activeCaseId, selected?.originalName])

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-fx-bg font-mono text-xs tracking-[0.2em] text-fx-dim uppercase">
        Initializing local vault…
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-fx-bg">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 border-r border-fx-border lg:block">
          <CaseSidebar />
        </aside>
        <main className="min-w-0 flex-1 border-r border-fx-border">
          <EvidenceViewer
            evidence={selected}
            onDropFiles={(files) => void importEvidence(files)}
          />
        </main>
        <aside className="hidden w-[300px] shrink-0 xl:block">
          <AiAnalystPanel />
        </aside>
      </div>

      <StatusBar onAddEvidence={() => fileInputRef.current?.click()} />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.jpe,.webp,.heic,.heif,.avif,.docx,.rtf,.md,.txt,.csv,.json,.xml,.html,.htm"
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
        title="Cases & Evidence"
        side="left"
      >
        <div className="h-[80dvh]">
          <CaseSidebar />
        </div>
      </Drawer>
      <Drawer
        open={mobilePanel === 'ai'}
        onOpenChange={(open) => setMobilePanel(open ? 'ai' : 'none')}
        title="ForenX AI"
        side="right"
      >
        <div className="h-[80dvh]">
          <AiAnalystPanel />
        </div>
      </Drawer>
    </div>
  )
}
