import { useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { runForensicAction } from '@/features/ai/runAnalysis'
import { localCaseRepository } from '@/lib/storage/repositories'
import { exportCaseJson, exportCaseMarkdown } from '@/features/export/exportCase'
import type { ForensicActionId } from '@/features/ai/actions/registry'

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

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.startsWith('>')) return []
    const hits: Array<{ id: string; label: string; onSelect: () => void }> = []
    for (const item of evidence) {
      if (item.originalName.toLowerCase().includes(q) || item.tags.some((t) => t.includes(q))) {
        hits.push({
          id: `ev-${item.id}`,
          label: `Evidence: ${item.originalName}`,
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
          label: `Entity: ${entity.canonicalValue}`,
          onSelect: () => setLeftTab('entities'),
        })
      }
    }
    for (const finding of findings) {
      if (finding.statement.toLowerCase().includes(q)) {
        hits.push({
          id: `find-${finding.id}`,
          label: `Finding: ${finding.statement.slice(0, 80)}`,
          onSelect: () => setLeftTab('findings'),
        })
      }
    }
    return hits.slice(0, 20)
  }, [query, evidence, entities, findings, setSelectedEvidence, setLeftTab])

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
    })
    await refreshCaseData()
    setAiBusy(false, result.error ?? null)
    setStatusMessage(result.error ?? `${actionId} completed`)
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
        label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setCommandOpen(false)
        }}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search or run a command…"
          className="w-full border-b border-fx-border bg-transparent px-4 py-3 text-sm text-fx-text outline-none placeholder:text-fx-dim"
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-xs text-fx-dim">
            No results
          </Command.Empty>
          <Command.Group heading="Commands" className="text-[10px] text-fx-dim">
            <Item
              label="Add evidence"
              onSelect={() => {
                setCommandOpen(false)
                fileInputRef.current?.click()
              }}
            />
            <Item label="Run Auto Triage" onSelect={() => void run('auto_triage')} />
            <Item label="Extract entities" onSelect={() => void run('entity_extraction')} />
            <Item label="Generate timeline" onSelect={() => void run('timeline')} />
            <Item label="Find contradictions" onSelect={() => void run('contradictions')} />
            <Item label="Generate report" onSelect={() => void run('case_report')} />
            <Item
              label="Open audit log"
              onSelect={() => {
                setCommandOpen(false)
                setAuditOpen(true)
              }}
            />
            <Item
              label="Export JSON"
              onSelect={() => {
                if (!activeCaseId) return
                setCommandOpen(false)
                void exportCaseJson(activeCaseId).then(() => refreshCaseData())
              }}
            />
            <Item
              label="Export Markdown"
              onSelect={() => {
                if (!activeCaseId) return
                setCommandOpen(false)
                void exportCaseMarkdown(activeCaseId).then(() => refreshCaseData())
              }}
            />
          </Command.Group>
          {searchHits.length > 0 && (
            <Command.Group heading="Search" className="mt-2 text-[10px] text-fx-dim">
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
            Esc
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
