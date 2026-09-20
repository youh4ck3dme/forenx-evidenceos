const SETTINGS_KEY = 'forenx.workspace.settings'
const SCHEMA_VERSION = 2

import type { WorkspaceSettings } from './types'
import { createId } from '@/lib/utils/cn'

const defaultSettings = (): WorkspaceSettings => ({
  schemaVersion: SCHEMA_VERSION,
  theme: 'dark',
  activeCaseId: null,
  workspaceId: createId('ws'),
  workspaceLanguage: 'sk',
  aiMode: resolveDefaultAiMode(),
  promptOverrides: {},
  enteredSandbox: false,
})

function resolveDefaultAiMode(): WorkspaceSettings['aiMode'] {
  const fromEnv = import.meta.env.VITE_AI_MODE
  if (fromEnv === 'mock' || fromEnv === 'http' || fromEnv === 'auto') {
    return fromEnv
  }
  return 'auto'
}

export function loadSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      const settings = defaultSettings()
      saveSettings(settings)
      return settings
    }
    const parsed = JSON.parse(raw) as WorkspaceSettings
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      const migrated: WorkspaceSettings = {
        ...defaultSettings(),
        ...parsed,
        schemaVersion: SCHEMA_VERSION,
        workspaceLanguage:
          parsed.workspaceLanguage === 'en' || parsed.workspaceLanguage === 'sk'
            ? parsed.workspaceLanguage
            : 'sk',
        theme: parsed.theme === 'light' ? 'light' : 'dark',
      }
      saveSettings(migrated)
      return migrated
    }
    return {
      ...parsed,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      workspaceLanguage:
        parsed.workspaceLanguage === 'en' || parsed.workspaceLanguage === 'sk'
          ? parsed.workspaceLanguage
          : 'sk',
    }
  } catch {
    const settings = defaultSettings()
    saveSettings(settings)
    return settings
  }
}

export function saveSettings(settings: WorkspaceSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function patchSettings(
  patch: Partial<WorkspaceSettings>,
): WorkspaceSettings {
  const next = { ...loadSettings(), ...patch }
  saveSettings(next)
  return next
}
