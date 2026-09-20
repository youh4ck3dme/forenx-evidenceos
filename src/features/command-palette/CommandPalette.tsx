import { useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { runForensicAction } from '@/features/ai/runAnalysis'
import { localCaseRepository } from '@/lib/storage/repositories'
import { exportCaseJson, exportCaseMarkdown } from '@/features/export/exportCase'
import type { ForensicActionId } from '@/features/ai/actions/registry'
import { getLocale, useLocale } from '@/lib/i18n'

export function CommandPalette({
  fileInputRef,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const open = useWorkspaceStore((s) => s.commandOpen)
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const setAuditOpen = useWorkspaceStore((s) => s.setAuditOpen)
  const evidence = useWorkspaceStore((s) => s.evidence)
  const findings = useWorkspaceStore((s) => s.findings)
  const entities = useWorkspaceStore((s) => s.entities)
  const selectedEvidenceIds = useWorkspaceStore((s) => s.selectedEvidenceIds)
  const activeCaseId = useWorkspaceStore((s) => s.activeCaseId)
  const setSelectedEvidence = useWorkspaceStore((s) => s.setSelectedEvidence)
  const refreshCaseData = useWorkspaceStore((s) => s.refreshCaseData)
  const setAiBusy = useWorkspaceStore((s) => s.setAiBusy)
  const setStatusMessage = useWorkspaceStore((s) => s.setStatusMessage)
  const setLeftTab = useWorkspaceStore((s) => s.setLeftTab)
  const [query, setQuery] = useState('')
  const { t } = useLocale()

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.startsWith('>')) return []
    const hits: Array<{ id: string; label: string; onSelect: () => void }> = []
    for (const item of evidence) {
      if (
        item.originalName.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.includes(q))
      ) {
        hits.push({
          id: `ev-${item.id}`,
          label: t('cmd.evidence', { name: item.originalName }),
          onSelect: () => setSelectedEvidence([item.id]),
        })
      }
    }
    for (const entity of entities) {
      if (
        entity.canonicalValue.toLowerCase().includes(q) ||
        entity.aliases.some((a) => a.toLowerCase().includes(q))
      ) {
        hits.push({
          id: `ent-${entity.id}`,
          label: t('cmd.entity', { name: entity.canonicalValue }),
          onSelect: () => setLeftTab('entities'),
        })
      }
    }
    for (const finding of findings) {
      if (finding.statement.toLowerCase().includes(q)) {
        hits.push({
          id: `find-${finding.id}`,
          label: t('cmd.finding', { text: finding.statement.slice(0, 80) }),
          onSelect: () => setLeftTab('findings'),
        })
      }
    }
    return hits.slice(0, 20)
  }, [query, evidence, entities, findings, setSelectedEvidence, setLeftTab, t])

  async function run(actionId: ForensicActionId) {
    if (!activeCaseId) return
    const caseRecord = await localCaseRepository.get(activeCaseId)
    if (!caseRecord) return
    setCommandOpen(false)
    setAiBusy(true)
    const result = await runForensicAction({
      actionId,
      caseRecord,
      evidenceIds:
        selectedEvidenceIds.length > 0
          ? selectedEvidenceIds
          : evidence.map((e) => e.id),
      workspaceLanguage: getLocale(),
    })
    if (result.status === 'LIVE' || result.status === 'MOCK' || result.status === 'OFFLINE') {
      useWorkspaceStore.setState({ aiStatus: result.status })
    }
    await refreshCaseData()
    setAiBusy(false, result.error ?? null)
    setStatusMessage(
      result.error ?? t('ai.completed', { action: actionId, status: result.status }),
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={() => setCommandOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setCommandOpen(false)
      }}
    >
      <Command
        className="w-[min(560px,92vw)] overflow-hidden rounded-sm border border-fx-border bg-fx-panel shadow-2xl"
        label={t('cmd.title')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setCommandOpen(false)
        }}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t('cmd.placeholder')}
          className="w-full border-b border-fx-border bg-transparent px-4 py-3 text-sm text-fx-text outline-none placeholder:text-fx-dim"
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-xs text-fx-dim">
            {t('cmd.empty')}
          </Command.Empty>
          <Command.Group
            heading={t('cmd.group.commands')}
            className="text-[10px] text-fx-dim"
          >
            <Item
              label={t('cmd.addEvidence')}
              onSelect={() => {
                setCommandOpen(false)
                fileInputRef.current?.click()
              }}
            />
            <Item label={t('cmd.autoTriage')} onSelect={() => void run('auto_triage')} />
            <Item label={t('cmd.entities')} onSelect={() => void run('entity_extraction')} />
            <Item label={t('cmd.timeline')} onSelect={() => void run('timeline')} />
            <Item
              label={t('cmd.contradictions')}
              onSelect={() => void run('contradictions')}
            />
            <Item label={t('cmd.report')} onSelect={() => void run('case_report')} />
            <Item
              label={t('cmd.audit')}
              onSelect={() => {
                setCommandOpen(false)
                setAuditOpen(true)
              }}
            />
            <Item
              label={t('cmd.exportJson')}
              onSelect={() => {
                if (!activeCaseId) return
                setCommandOpen(false)
                void exportCaseJson(activeCaseId).then(() => refreshCaseData())
              }}
            />
            <Item
              label={t('cmd.exportMd')}
              onSelect={() => {
                if (!activeCaseId) return
                setCommandOpen(false)
                void exportCaseMarkdown(activeCaseId).then(() => refreshCaseData())
              }}
            />
          </Command.Group>
          {searchHits.length > 0 && (
            <Command.Group
              heading={t('cmd.group.search')}
              className="mt-2 text-[10px] text-fx-dim"
            >
              {searchHits.map((hit) => (
                <Item
                  key={hit.id}
                  label={hit.label}
                  onSelect={() => {
                    setCommandOpen(false)
                    hit.onSelect()
                  }}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-fx-border px-3 py-2 text-right">
          <button
            type="button"
            className="text-xs text-fx-dim hover:text-fx-text"
            onClick={() => setCommandOpen(false)}
          >
            {t('cmd.esc')}
          </button>
        </div>
      </Command>
    </div>
  )
}

function Item({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="cursor-pointer rounded-sm px-2 py-2 text-sm text-fx-text aria-selected:bg-fx-elevated"
    >
      {label}
    </Command.Item>
  )
}
