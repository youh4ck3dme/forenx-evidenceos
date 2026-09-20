import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { WelcomeAtmosphere } from '@/features/cases/WelcomeAtmosphere'
import { useWorkspaceStore } from '@/features/cases/workspaceStore'
import { useLocale } from '@/lib/i18n'

export function WelcomePage() {
  const navigate = useNavigate()
  const enterSandbox = useWorkspaceStore((s) => s.enterSandbox)
  const { t } = useLocale()

  return (
    <div className="fx-shell fx-grid-bg relative flex flex-col">
      <WelcomeAtmosphere />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-6 py-4 md:px-10 md:py-5">
        <div className="font-mono text-[11px] tracking-[0.28em] text-fx-dim uppercase">
          {t('welcome.badge')}
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <div className="font-mono text-[11px] tracking-[0.18em] text-fx-dim">
            {t('welcome.mvp')}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-6 text-center">
        <img
          src="/forenx-icon-512.png"
          alt=""
          className="mb-6 h-14 w-14 rounded-[18%] shadow-[0_12px_40px_rgb(0_0_0/0.18)] opacity-0 animate-[fadeIn_0.6s_ease_forwards] md:mb-8 md:h-20 md:w-20"
          style={{ animationDelay: '40ms' }}
        />
        <p
          className="mb-4 font-mono text-[11px] tracking-[0.35em] text-fx-accent uppercase opacity-0 animate-[fadeIn_0.6s_ease_forwards] md:mb-6"
          style={{ animationDelay: '80ms' }}
        >
          {t('welcome.eyebrow')}
        </p>
        <h1
          className="max-w-4xl text-[clamp(2rem,6.5vw,5.2rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-fx-text opacity-0 animate-[fadeIn_0.7s_ease_forwards]"
          style={{ animationDelay: '160ms' }}
        >
          {t('welcome.brand')}
          <span className="block text-fx-muted">{t('welcome.product')}</span>
        </h1>
        <p
          className="mt-4 max-w-xl text-sm text-fx-muted opacity-0 animate-[fadeIn_0.7s_ease_forwards] md:mt-6 md:text-lg"
          style={{ animationDelay: '280ms' }}
        >
          {t('welcome.tagline')}
        </p>
        <div
          className="mt-8 opacity-0 animate-[fadeIn_0.7s_ease_forwards] md:mt-10"
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
            {t('welcome.cta')}
          </Button>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 border-t border-fx-border-subtle px-6 py-3 font-mono text-[11px] text-fx-dim md:px-10 md:py-4">
        {t('welcome.footer')}
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
