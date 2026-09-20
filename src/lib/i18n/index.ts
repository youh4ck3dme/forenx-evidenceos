import { useSyncExternalStore } from 'react'
import { loadSettings, patchSettings } from '@/lib/storage/settings'
import { en } from './locales/en'
import { sk } from './locales/sk'
import type { Locale, MessageKey, Messages } from './types'

const catalogs: Record<Locale, Messages> = { sk, en }

type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function readLocale(): Locale {
  const lang = loadSettings().workspaceLanguage
  return lang === 'en' ? 'en' : 'sk'
}

export function getLocale(): Locale {
  return readLocale()
}

export function setLocale(locale: Locale): void {
  patchSettings({ workspaceLanguage: locale })
  emit()
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
  locale: Locale = readLocale(),
): string {
  const template = catalogs[locale][key] ?? catalogs.en[key] ?? key
  if (!params) return template
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

export function useLocale(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
} {
  const locale = useSyncExternalStore(subscribeLocale, readLocale, () => 'sk' as Locale)
  return {
    locale,
    setLocale,
    t: (key, params) => t(key, params, locale),
  }
}

export type { Locale, MessageKey }
