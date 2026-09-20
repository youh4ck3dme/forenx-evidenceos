import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/i18n'

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useLocale()
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      previous?.focus?.()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="w-[min(420px,100%)] border border-fx-border bg-fx-panel p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="font-mono text-[11px] tracking-[0.2em] text-fx-muted uppercase"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-fx-text">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel ?? t('confirm.cancel')}
          </Button>
          <Button size="sm" onClick={onConfirm}>
            {confirmLabel ?? t('confirm.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
