import { useState } from 'react'
import { FORENSIC_ACTIONS, type ForensicActionId } from '@/features/ai/actions/registry'
import { runForensicAction } from '@/features/ai/runAnalysis'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn, formatDateTime } from '@/lib/utils/cn'
import { localCaseRepository } from '@/lib/storage/repositories'
import { useLocale, type MessageKey, getLocale } from '@/lib/i18n'

export function AiAnalystPanel() {
  const aiStatus = useWorkspaceStore((s) => s.aiStatus)
  const aiBusy = useWorkspaceStore((s) => s.aiBusy)
  const aiError = useWorkspaceStore((s) => s.aiError)
  const findings = useWorkspaceStore((s) => s.findings)
  const aiRuns = useWorkspaceStore((s) => s.aiRuns)
  const selectedEvidenceIds = useWorkspaceStore((s) => s.selectedEvidenceIds)
  const activeCaseId = useWorkspaceStore((s) => s.activeCaseId)
  const refreshCaseData = useWorkspaceStore((s) => s.refreshCaseData)
  const refreshAiStatus = useWorkspaceStore((s) => s.refreshAiStatus)
  const setAiBusy = useWorkspaceStore((s) => s.setAiBusy)
  const setStatusMessage = useWorkspaceStore((s) => s.setStatusMessage)
  const { t } = useLocale()
  const [pendingAction, setPendingAction] = useState<ForensicActionId | null>(null)

  function requestAction(actionId: ForensicActionId) {
    if (!activeCaseId) {
      setStatusMessage(t('ai.createCaseFirst'))
      return
    }
    if (
      !selectedEvidenceIds.length &&
      actionId !== 'case_report' &&
      actionId !== 'evidence_gaps' &&
      actionId !== 'investigator_questions'
    ) {
      setStatusMessage(t('ai.selectEvidence'))
      return
    }

    if (!navigator.onLine) {
      useWorkspaceStore.setState({ aiStatus: 'OFFLINE' })
      setAiBusy(false, t('ai.offline'))
      setStatusMessage(t('ai.offline'))
      return
    }

    setPendingAction(actionId)
  }

  async function executeAction(actionId: ForensicActionId) {
    setPendingAction(null)
    if (!activeCaseId) return

    const caseRecord = await localCaseRepository.get(activeCaseId)
    if (!caseRecord) return

    setAiBusy(true, null)
    setStatusMessage(t('ai.running', { action: actionId }))
    try {
      const result = await runForensicAction({
        actionId,
        caseRecord,
        evidenceIds:
          selectedEvidenceIds.length > 0
            ? selectedEvidenceIds
            : useWorkspaceStore.getState().evidence.map((e) => e.id),
        workspaceLanguage: getLocale(),
      })
      if (
        result.status === 'LIVE' ||
        result.status === 'MOCK' ||
        result.status === 'OFFLINE'
      ) {
        useWorkspaceStore.setState({ aiStatus: result.status })
      }
      await refreshCaseData()
      if (result.error) {
        setAiBusy(false, result.error)
        setStatusMessage(result.error)
      } else {
        setAiBusy(false, null)
        setStatusMessage(
          t('ai.completed', { action: actionId, status: result.status }),
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('ai.failed')
      setAiBusy(false, message)
      setStatusMessage(message)
    }
  }

  const statusColor =
    aiStatus === 'LIVE'
      ? 'text-fx-ok'
      : aiStatus === 'MOCK'
        ? 'text-fx-warn'
        : aiStatus === 'OFFLINE'
          ? 'text-fx-danger'
          : 'text-fx-muted'

  return (
    <div className="flex h-full min-h-0 flex-col bg-fx-panel">
      <div className="border-b border-fx-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[11px] tracking-[0.22em] text-fx-muted uppercase">
            {t('ai.title')}
          </div>
          <div className={cn('font-mono text-[10px] tracking-wider uppercase', statusColor)}>
            {t('ai.status', { status: aiStatus })}
          </div>
        </div>
        {aiError && <p className="mt-2 text-xs text-fx-danger">{aiError}</p>}
        <p className="mt-2 text-[11px] text-fx-dim">{t('ai.untrusted')}</p>
        {aiStatus === 'IDLE' && (
          <p className="mt-1 text-[10px] text-fx-dim">{t('ai.idleHint')}</p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <div className="space-y-1">
          {FORENSIC_ACTIONS.map((action) => {
            const nameKey = `action.${action.id}.name` as MessageKey
            const descKey = `action.${action.id}.desc` as MessageKey
            return (
              <button
                key={action.id}
                type="button"
                disabled={aiBusy}
                onClick={() => requestAction(action.id)}
                className="flex w-full items-start gap-2 rounded-sm border border-transparent px-2 py-1.5 text-left hover:border-fx-border hover:bg-fx-elevated disabled:opacity-50"
              >
                <span className="font-mono text-[10px] text-fx-dim">
                  {String(action.number).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-fx-text">
                    {t(nameKey)}
                  </span>
                  <span className="block text-[10px] text-fx-dim line-clamp-2">
                    {t(descKey)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-fx-border">
        <div className="px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-fx-dim uppercase">
          {t('ai.findings', { count: findings.length })}
        </div>
        <ScrollArea className="max-h-48 px-3 pb-3">
          {findings.length === 0 ? (
            <p className="text-xs text-fx-dim">{t('ai.noFindings')}</p>
          ) : (
            <ul className="space-y-2">
              {findings.slice(0, 12).map((f) => (
                <li
                  key={f.id}
                  className="border-l-2 border-fx-accent-soft pl-2 text-xs text-fx-muted"
                >
                  <div className="text-fx-text">{f.statement}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-fx-dim">
                    {f.actionId} · {f.epistemicClass} ·{' '}
                    {(f.confidence * 100).toFixed(0)}% · {formatDateTime(f.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-fx-border-subtle px-3 py-2">
          <div className="mb-1 font-mono text-[10px] text-fx-dim uppercase">
            {t('ai.recentRuns')}
          </div>
          <div className="space-y-1">
            {aiRuns.slice(0, 4).map((run) => (
              <div key={run.id} className="font-mono text-[10px] text-fx-muted">
                {run.actionId} · {run.status}
              </div>
            ))}
            {!aiRuns.length && (
              <div className="text-[10px] text-fx-dim">{t('ai.noRuns')}</div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => void refreshAiStatus()}
          >
            {t('ai.refreshStatus')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={t('confirm.ai.title')}
        body={t('confirm.ai.body')}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) void executeAction(pendingAction)
        }}
      />
    </div>
  )
}
