import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  side?: 'right' | 'left'
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex h-full w-[min(420px,100vw)] flex-col border-fx-border bg-fx-panel shadow-2xl outline-none',
            side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          )}
        >
          <div className="flex items-center justify-between border-b border-fx-border px-4 py-3">
            <Dialog.Title className="font-mono text-xs tracking-[0.18em] text-fx-muted uppercase">
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 text-fx-muted hover:bg-fx-elevated hover:text-fx-text">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
