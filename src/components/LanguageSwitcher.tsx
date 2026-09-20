import { cn } from '@/lib/utils/cn'
import { useLocale, type Locale } from '@/lib/i18n'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.14em]',
        className,
      )}
      role="group"
      aria-label={t('lang.label')}
    >
      {(['sk', 'en'] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            'px-1.5 py-0.5 uppercase transition-colors',
            locale === code
              ? 'text-fx-text'
              : 'text-fx-dim hover:text-fx-muted',
          )}
          aria-pressed={locale === code}
        >
          {t(code === 'sk' ? 'lang.sk' : 'lang.en')}
        </button>
      ))}
    </div>
  )
}
