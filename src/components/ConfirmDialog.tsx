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
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fx-confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-[min(420px,100%)] border border-fx-border bg-fx-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="fx-confirm-title"
          className="font-mono text-[11px] tracking-[0.2em] text-fx-muted uppercase"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-fx-text">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
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
