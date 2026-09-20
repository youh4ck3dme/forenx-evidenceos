import { useMemo } from 'react'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatDateTime } from '@/lib/utils/cn'
import type { EvidenceSection } from '@/lib/storage/types'

const SECTION_LABELS: EvidenceSection[] = [
  'IDENTITY',
  'COMMUNICATION',
  'FINANCIAL',
  'CONTRACT',
  'TECHNICAL',
  'MEDIA',
  'TIMELINE',
  'LEGAL_DOCUMENT',
  'ADMINISTRATIVE',
  'LOCATION',
  'OTHER',
]

export function CaseSidebar() {
  const cases = useWorkspaceStore((s) => s.cases)
  const activeCaseId = useWorkspaceStore((s) => s.activeCaseId)
  const evidence = useWorkspaceStore((s) => s.evidence)
  const selectedEvidenceIds = useWorkspaceStore((s) => s.selectedEvidenceIds)
  const findings = useWorkspaceStore((s) => s.findings)
  const entities = useWorkspaceStore((s) => s.entities)
  const timelineEvents = useWorkspaceStore((s) => s.timelineEvents)
  const leftTab = useWorkspaceStore((s) => s.leftTab)
  const createCase = useWorkspaceStore((s) => s.createCase)
  const selectCase = useWorkspaceStore((s) => s.selectCase)
  const setSelectedEvidence = useWorkspaceStore((s) => s.setSelectedEvidence)
  const toggleEvidenceSelection = useWorkspaceStore((s) => s.toggleEvidenceSelection)
  const setLeftTab = useWorkspaceStore((s) => s.setLeftTab)

  const activeCase = cases.find((c) => c.id === activeCaseId)

  const bySection = useMemo(() => {
    const map = new Map<EvidenceSection, number>()
    for (const section of SECTION_LABELS) map.set(section, 0)
    for (const item of evidence) {
      const section = item.sectionOverride ?? item.section
      map.set(section, (map.get(section) ?? 0) + 1)
    }
    return map
  }, [evidence])

  return (
    <div className="flex h-full min-h-0 flex-col bg-fx-panel">
      <div className="border-b border-fx-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] text-fx-dim uppercase">
              Case
            </div>
            <div className="mt-1 text-sm font-semibold text-fx-text">
              {activeCase ? `# ${activeCase.reference}` : 'No case'}
            </div>
            {activeCase && (
              <div className="truncate text-xs text-fx-muted">{activeCase.name}</div>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => void createCase()}>
            New
          </Button>
        </div>
        {cases.length > 1 && (
          <select
            className="mt-2 w-full rounded-sm border border-fx-border bg-fx-elevated px-2 py-1.5 text-xs text-fx-text"
            value={activeCaseId ?? ''}
            onChange={(e) => void selectCase(e.target.value)}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} — {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex border-b border-fx-border text-[10px] font-mono uppercase tracking-wider">
        {(
          [
            ['evidence', 'Evidence'],
            ['timeline', 'Timeline'],
            ['entities', 'Entities'],
            ['findings', 'Findings'],
            ['reports', 'Reports'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 px-1 py-2 text-fx-dim hover:text-fx-text',
              leftTab === id && 'border-b border-fx-accent text-fx-text',
            )}
            onClick={() => setLeftTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1 p-2">
        {leftTab === 'evidence' && (
          <div className="space-y-3">
            <div className="px-1 font-mono text-[10px] text-fx-dim uppercase">
              Evidence {evidence.length}
            </div>
            <div className="space-y-0.5 px-1 text-[10px] text-fx-dim">
              {SECTION_LABELS.filter((s) => (bySection.get(s) ?? 0) > 0).map((section) => (
                <div key={section} className="flex justify-between">
                  <span>{section}</span>
                  <span>{bySection.get(section)}</span>
                </div>
              ))}
            </div>
            <ul className="space-y-1">
              {evidence.map((item) => {
                const selected = selectedEvidenceIds.includes(item.id)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) toggleEvidenceSelection(item.id)
                        else setSelectedEvidence([item.id])
                      }}
                      className={cn(
                        'w-full rounded-sm border px-2 py-1.5 text-left',
                        selected
                          ? 'border-fx-accent bg-fx-elevated'
                          : 'border-transparent hover:bg-fx-elevated',
                      )}
                    >
                      <div className="truncate text-xs text-fx-text">
                        {item.originalName}
                      </div>
                      <div className="font-mono text-[10px] text-fx-dim">
                        {(item.sectionOverride ?? item.section).slice(0, 12)} ·{' '}
                        {item.status}
                      </div>
                    </button>
                  </li>
                )
              })}
              {!evidence.length && (
                <p className="px-1 text-xs text-fx-dim">No evidence imported.</p>
              )}
            </ul>
          </div>
        )}

        {leftTab === 'timeline' && (
          <ul className="space-y-2">
            {timelineEvents.map((event) => (
              <li key={event.id} className="border-l border-fx-border pl-2 text-xs">
                <div className="font-mono text-[10px] text-fx-accent">
                  {event.timestampOriginal}
                </div>
                <div className="text-fx-text">
                  {event.action || event.eventType}
                </div>
              </li>
            ))}
            {!timelineEvents.length && (
              <p className="text-xs text-fx-dim">No timeline events.</p>
            )}
          </ul>
        )}

        {leftTab === 'entities' && (
          <ul className="space-y-2">
            {entities.map((entity) => (
              <li key={entity.id} className="text-xs">
                <div className="font-mono text-[10px] text-fx-dim">
                  {entity.entityType}
                </div>
                <div className="text-fx-text">{entity.canonicalValue}</div>
              </li>
            ))}
            {!entities.length && (
              <p className="text-xs text-fx-dim">No entities extracted.</p>
            )}
          </ul>
        )}

        {leftTab === 'findings' && (
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.id} className="text-xs text-fx-muted">
                <div className="text-fx-text">{f.statement}</div>
                <div className="font-mono text-[10px] text-fx-dim">
                  {f.actionId} · {formatDateTime(f.createdAt)}
                </div>
              </li>
            ))}
            {!findings.length && (
              <p className="text-xs text-fx-dim">No findings yet.</p>
            )}
          </ul>
        )}

        {leftTab === 'reports' && (
          <div className="space-y-2 text-xs text-fx-muted">
            <p>
              Run <span className="text-fx-text">Case Report</span> from the AI
              panel to generate a structured report finding.
            </p>
            {findings
              .filter((f) => f.actionId === 'case_report')
              .map((f) => (
                <div key={f.id} className="border border-fx-border p-2">
                  <div className="font-mono text-[10px] text-fx-dim">
                    {formatDateTime(f.createdAt)}
                  </div>
                  <div className="mt-1 text-fx-text">{f.statement}</div>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
