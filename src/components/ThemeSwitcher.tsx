import { cn } from '@/lib/utils/cn'
import { useLocale } from '@/lib/i18n'
import { useTheme, type ThemeMode } from '@/lib/theme'

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const { t } = useLocale()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.14em]',
        className,
      )}
      role="group"
      aria-label={t('theme.label')}
    >
      {(['dark', 'light'] as ThemeMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          className={cn(
            'px-1.5 py-0.5 uppercase transition-colors',
            theme === mode
              ? 'text-fx-text'
              : 'text-fx-dim hover:text-fx-muted',
          )}
          aria-pressed={theme === mode}
        >
          {t(mode === 'dark' ? 'theme.dark' : 'theme.light')}
        </button>
      ))}
    </div>
  )
}
