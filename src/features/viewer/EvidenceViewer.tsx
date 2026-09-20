import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { readEvidenceBlob } from '@/lib/storage/opfs'
import { localExtractionRepository } from '@/lib/storage/repositories'
import type { EvidenceItem, ExtractionRecord } from '@/lib/storage/types'
import { sanitizeHtmlToText } from '@/lib/security/evidence'
import { cn, formatBytes, truncateHash } from '@/lib/utils/cn'
import { pdfjs } from '@/lib/parsers'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLocale } from '@/lib/i18n'

marked.setOptions({ breaks: true })

export function EvidenceViewer({
  evidence,
  onDropFiles,
}: {
  evidence: EvidenceItem | null
  onDropFiles: (files: FileList) => void
}) {
  const { t } = useLocale()
  const [extraction, setExtraction] = useState<ExtractionRecord | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string>('')
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    let loadingTask: { destroy: () => void } | null = null

    async function load() {
      setError(null)
      setLoading(Boolean(evidence))
      setPdfPages([])
      setTextContent('')
      setExtraction(null)
      setPage(1)
      if (!evidence) {
        setObjectUrl(null)
        setLoading(false)
        return
      }

      const ex = await localExtractionRepository.getByEvidence(evidence.id)
      if (!cancelled) setExtraction(ex ?? null)

      try {
        const path = evidence.normalizedPath ?? evidence.storagePath
        const blob = await readEvidenceBlob(path)
        const url = URL.createObjectURL(blob)
        revoked = url
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setObjectUrl(url)

        const mime = evidence.detectedMime
        const name = evidence.originalName.toLowerCase()

        if (mime === 'application/pdf' || name.endsWith('.pdf')) {
          const data = new Uint8Array(await blob.arrayBuffer())
          const task = pdfjs.getDocument({ data })
          loadingTask = task
          const doc = await task.promise
          const pages: string[] = []
          for (let i = 1; i <= doc.numPages; i += 1) pages.push(String(i))
          if (!cancelled) setPdfPages(pages)
        } else if (
          mime.startsWith('text/') ||
          /\.(txt|md|csv|json|xml|html|htm|rtf)$/i.test(name)
        ) {
          const text = await blob.text()
          if (!cancelled) setTextContent(text)
        } else if (ex?.text) {
          if (!cancelled) setTextContent(ex.text)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('viewer.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      try {
        loadingTask?.destroy()
      } catch {
        /* ignore */
      }
      if (revoked) URL.revokeObjectURL(revoked)
    }
    // Intentionally omit `t` — useLocale() returns a new function each render and
    // would retrigger this effect in a tight loop (breaks pdf.js on WebKit).
  }, [
    evidence?.id,
    evidence?.storagePath,
    evidence?.normalizedPath,
    evidence?.detectedMime,
    evidence?.originalName,
  ])

  useEffect(() => {
    let cancelled = false
    let loadingTask: { destroy: () => void } | null = null

    async function renderPdfPage() {
      if (!evidence || !objectUrl || pdfPages.length === 0 || !canvasRef.current) return
      const blob = await fetch(objectUrl).then((r) => r.arrayBuffer())
      if (cancelled) return
      const task = pdfjs.getDocument({ data: new Uint8Array(blob) })
      loadingTask = task
      const doc = await task.promise
      if (cancelled) return
      const pdfPage = await doc.getPage(page)
      const viewport = pdfPage.getViewport({ scale: 1.25 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise
    }
    void renderPdfPage()
    return () => {
      cancelled = true
      try {
        loadingTask?.destroy()
      } catch {
        /* ignore */
      }
    }
  }, [evidence?.id, objectUrl, pdfPages, page])

  const mdHtml = useMemo(() => {
    if (!evidence?.originalName.toLowerCase().endsWith('.md')) return null
    const raw = marked.parse(textContent || extraction?.text || '') as string
    // Never inject unsanitized HTML — convert to safe text blocks via marked then strip tags for display as preformatted structure
    return sanitizeHtmlToText(raw)
  }, [evidence, textContent, extraction])

  if (!evidence) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center border border-dashed border-fx-border bg-fx-surface/40 px-6 text-center transition-colors',
          dragOver && 'border-fx-accent bg-fx-accent/5',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files)
        }}
      >
        <div className="font-mono text-[11px] tracking-[0.28em] text-fx-accent uppercase">
          {t('viewer.title')}
        </div>
        <p className="mt-3 max-w-md text-sm text-fx-muted">{t('viewer.empty')}</p>
      </div>
    )
  }

  const isImage =
    evidence.detectedMime.startsWith('image/') ||
    /\.(png|jpe?g|jpe|webp|heic|heif|avif)$/i.test(evidence.originalName)
  const isPdf =
    evidence.detectedMime === 'application/pdf' ||
    evidence.originalName.toLowerCase().endsWith('.pdf')

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-fx-surface"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files)
      }}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-fx-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-fx-text">
            {evidence.originalName}
          </div>
          <div className="mt-0.5 font-mono text-[10px] tracking-wide text-fx-dim uppercase">
            {evidence.detectedMime} · {formatBytes(evidence.byteSize)} ·{' '}
            {evidence.status}
            {evidence.quarantineReason
              ? ` · ${t('viewer.quarantined', { reason: evidence.quarantineReason })}`
              : ''}
          </div>
        </div>
        <div className="font-mono text-[10px] text-fx-muted">
          SHA256 {truncateHash(evidence.sha256)}
        </div>
        <div className="rounded-sm border border-fx-border px-2 py-0.5 font-mono text-[10px] tracking-wider text-fx-ok uppercase">
          {t('viewer.originalImmutable')}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {loading && (
          <div className="p-4 font-mono text-[11px] tracking-wider text-fx-dim uppercase">
            {t('viewer.loading')}
          </div>
        )}
        {error && (
          <div className="p-4 text-sm text-fx-danger">{error}</div>
        )}
        {evidence.status === 'QUARANTINED' && (
          <div className="p-4 text-sm text-fx-warn">
            {t('viewer.quarantined', {
              reason: evidence.quarantineReason ?? t('quarantine.unknown'),
            })}
          </div>
        )}
        {!loading && !error && isPdf && (
          <ScrollArea className="h-full p-4">
            <canvas ref={canvasRef} className="mx-auto max-w-full bg-white shadow-lg" />
          </ScrollArea>
        )}
        {!loading && !error && isImage && objectUrl && (
          <ScrollArea className="h-full p-4">
            <img
              src={objectUrl}
              alt={evidence.originalName}
              className="mx-auto max-h-full max-w-full object-contain"
            />
          </ScrollArea>
        )}
        {!loading && !error && !isPdf && !isImage && (
          <ScrollArea className="h-full p-4">
            {evidence.originalName.toLowerCase().endsWith('.md') ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-fx-text">
                {mdHtml || textContent || extraction?.text || t('viewer.noContent')}
              </pre>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-fx-muted">
                {textContent || extraction?.text || t('viewer.noExtractedText')}
              </pre>
            )}
          </ScrollArea>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-fx-border px-4 py-2 font-mono text-[10px] text-fx-dim">
        {isPdf && pdfPages.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hover:text-fx-text"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('viewer.prev')}
            </button>
            <span>
              {t('viewer.page', { page, total: pdfPages.length })}
            </span>
            <button
              type="button"
              className="hover:text-fx-text"
              disabled={page >= pdfPages.length}
              onClick={() => setPage((p) => Math.min(pdfPages.length, p + 1))}
            >
              {t('viewer.next')}
            </button>
          </div>
        )}
        <span>
          {t('viewer.section', {
            section: evidence.sectionOverride ?? evidence.section,
          })}
        </span>
        {extraction?.ocrConfidence != null && (
          <span>
            {t('viewer.ocrConfidence', {
              pct: (extraction.ocrConfidence * 100).toFixed(1),
            })}
          </span>
        )}
        {extraction && (
          <span>{t('viewer.extractedVia', { processor: extraction.processor })}</span>
        )}
      </div>
    </div>
  )
}
