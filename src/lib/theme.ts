import { useCallback, useSyncExternalStore } from 'react'
import { loadSettings, patchSettings } from '@/lib/storage/settings'

export type ThemeMode = 'dark' | 'light'

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#e8ecf1' : '#0a0b0d')
}

export function getTheme(): ThemeMode {
  const theme = loadSettings().theme
  return theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: ThemeMode) {
  patchSettings({ theme })
  applyTheme(theme)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Boot once before React paints when possible. */
export function initTheme() {
  applyTheme(getTheme())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as ThemeMode)
  const set = useCallback((next: ThemeMode) => {
    setTheme(next)
  }, [])
  return { theme, setTheme: set }
}
