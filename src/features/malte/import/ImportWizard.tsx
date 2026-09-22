import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createId } from '@/lib/utils/cn'
import { localTransactionRepository } from '@/lib/storage/repositories'
import { appendAuditChained } from '@/lib/storage/auditChain'
import {
  parseTabularFile,
  previewMappedRows,
  rowsToTransactions,
  suggestColumnMap,
  TX_COLUMN_OPTIONS,
  type ParsedSheet,
  type TxColumnKey,
} from './columnMap'

export function ImportWizard({
  caseId,
  workspaceId,
  onDone,
  onCancel,
}: {
  caseId: string
  workspaceId: string
  onDone: (count: number) => void
  onCancel: () => void
}) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<TxColumnKey[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(
    () => (sheet ? previewMappedRows(sheet, map, 6) : []),
    [sheet, map],
  )

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const parsed = await parseTabularFile(file)
      if (!parsed.headers.length) {
        setError('Empty file or no header row.')
        return
      }
      setSheet(parsed)
      setFileName(file.name)
      setMap(suggestColumnMap(parsed.headers))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function commit() {
    if (!sheet) return
    setBusy(true)
    setError(null)
    try {
      const { transactions, skipped, errors } = rowsToTransactions(sheet, map, {
        caseId,
        workspaceId,
      })
      if (!transactions.length) {
        setError(errors[0] ?? 'No valid rows to import.')
        return
      }
      await localTransactionRepository.putMany(transactions)
      await appendAuditChained({
        id: createId('audit'),
        caseId,
        workspaceId,
        type: 'MALTE_IMPORT',
        createdAt: new Date().toISOString(),
        message: `Malte import ${fileName}: ${transactions.length} transactions`,
        meta: {
          fileName,
          imported: transactions.length,
          skipped,
          columns: map,
          sampleErrors: errors.slice(0, 5),
        },
      })
      onDone(transactions.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-fx-panel">
      <div className="border-b border-fx-border px-3 py-3">
        <div className="font-mono text-[10px] tracking-[0.2em] text-fx-dim uppercase">
          Malte · Import
        </div>
        <h2 className="mt-1 text-sm font-semibold text-fx-text">
          CSV / XLSX column mapping
        </h2>
        <p className="mt-1 text-xs text-fx-muted">
          Map statement columns, preview rows, then commit into the case model.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-fx-border bg-fx-elevated/40 px-4 py-6 text-center text-xs text-fx-muted hover:border-fx-accent">
          <span className="text-fx-text">{fileName || 'Choose CSV or XLSX'}</span>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {sheet && (
          <div className="mt-4 space-y-3">
            <div className="font-mono text-[10px] text-fx-dim uppercase">
              Map columns ({sheet.rows.length} data rows)
            </div>
            <div className="space-y-2">
              {sheet.headers.map((header, i) => (
                <div key={`${header}-${i}`} className="flex items-center gap-2">
                  <div className="w-1/2 truncate text-xs text-fx-text" title={header}>
                    {header}
                  </div>
                  <select
                    className="w-1/2 rounded-sm border border-fx-border bg-fx-elevated px-2 py-1.5 text-xs text-fx-text"
                    value={map[i] ?? 'skip'}
                    onChange={(e) => {
                      const next = [...map]
                      next[i] = e.target.value as TxColumnKey
                      setMap(next)
                    }}
                  >
                    {TX_COLUMN_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="font-mono text-[10px] text-fx-dim uppercase">Preview</div>
            <div className="overflow-x-auto rounded-sm border border-fx-border">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead className="bg-fx-elevated text-fx-dim">
                  <tr>
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Amount</th>
                    <th className="px-2 py-1">From</th>
                    <th className="px-2 py-1">To</th>
                    <th className="px-2 py-1">OK</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowIndex} className="border-t border-fx-border">
                      <td className="px-2 py-1 text-fx-dim">{row.rowIndex}</td>
                      <td className="px-2 py-1 text-fx-text">{row.bookedAt.slice(0, 10)}</td>
                      <td className="px-2 py-1 text-fx-text">
                        {row.amount} {row.currency}
                      </td>
                      <td className="max-w-[100px] truncate px-2 py-1 text-fx-muted">
                        {row.fromLabel}
                      </td>
                      <td className="max-w-[100px] truncate px-2 py-1 text-fx-muted">
                        {row.toLabel}
                      </td>
                      <td className="px-2 py-1">
                        {row.ok ? (
                          <span className="text-fx-ok">✓</span>
                        ) : (
                          <span className="text-fx-danger" title={row.errors.join('; ')}>
                            ✗
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-fx-danger">{error}</p>}
      </ScrollArea>

      <div className="flex gap-2 border-t border-fx-border p-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!sheet || busy}
          onClick={() => void commit()}
        >
          {busy ? 'Importing…' : 'Commit import'}
        </Button>
      </div>
    </div>
  )
}
