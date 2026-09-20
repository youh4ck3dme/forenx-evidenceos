import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'

export function WelcomePage() {
  const navigate = useNavigate()
  const enterSandbox = useWorkspaceStore((s) => s.enterSandbox)

  return (
    <div className="fx-grid-bg relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(122_158_184/0.08),transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="font-mono text-[11px] tracking-[0.28em] text-fx-dim uppercase">
          Local-first · No auth · Browser vault
        </div>
        <div className="font-mono text-[11px] tracking-[0.18em] text-fx-dim">
          MVP 0.1
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p
          className="mb-6 font-mono text-[11px] tracking-[0.35em] text-fx-accent uppercase opacity-0 animate-[fadeUp_0.7s_ease_forwards]"
          style={{ animationDelay: '80ms' }}
        >
          Forensic workstation
        </p>
        <h1
          className="max-w-4xl text-[clamp(2.4rem,7vw,5.2rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-fx-text opacity-0 animate-[fadeUp_0.8s_ease_forwards]"
          style={{ animationDelay: '160ms' }}
        >
          FORENX
          <span className="block text-fx-muted">EVIDENCE OS</span>
        </h1>
        <p
          className="mt-6 max-w-xl text-base text-fx-muted md:text-lg opacity-0 animate-[fadeUp_0.8s_ease_forwards]"
          style={{ animationDelay: '280ms' }}
        >
          Local-first AI Forensic Workspace. Evidence stays in your browser.
          Originals are immutable. Analysis is derived and reviewable.
        </p>
        <div
          className="mt-10 opacity-0 animate-[fadeUp_0.8s_ease_forwards]"
          style={{ animationDelay: '420ms' }}
        >
          <Button
            size="lg"
            className="min-w-[220px] tracking-[0.14em] uppercase"
            onClick={() => {
              enterSandbox()
              navigate('/sandbox')
            }}
          >
            Enter Sandbox
          </Button>
        </div>
      </main>

      <footer className="relative z-10 border-t border-fx-border-subtle px-6 py-4 font-mono text-[11px] text-fx-dim md:px-10">
        IndexedDB · OPFS · WebCrypto SHA-256 · Mistral structured outputs
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
