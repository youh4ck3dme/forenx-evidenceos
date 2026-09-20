import { SCHEMA_VERSION } from "@/domain/types";

const PREFIX = "forenx.";

export interface WorkspaceSettings {
  schemaVersion: number;
  hasEnteredSandbox: boolean;
  activeCaseId: string | null;
  promptOverrides: Record<string, string>;
  theme: "dark" | "light";
}

const DEFAULTS: WorkspaceSettings = {
  schemaVersion: SCHEMA_VERSION,
  hasEnteredSandbox: false,
  activeCaseId: null,
  promptOverrides: {},
  theme: "dark",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota — settings are non-critical.
  }
}

export function loadSettings(): WorkspaceSettings {
  const theme = readJson("theme", DEFAULTS.theme);
  return {
    schemaVersion: readJson("schemaVersion", DEFAULTS.schemaVersion),
    hasEnteredSandbox: readJson("hasEnteredSandbox", DEFAULTS.hasEnteredSandbox),
    activeCaseId: readJson("activeCaseId", DEFAULTS.activeCaseId),
    promptOverrides: readJson("promptOverrides", DEFAULTS.promptOverrides),
    theme: theme === "light" ? "light" : "dark",
  };
}

export function saveSettings(partial: Partial<WorkspaceSettings>) {
  const current = loadSettings();
  const next = { ...current, ...partial, schemaVersion: SCHEMA_VERSION };
  writeJson("schemaVersion", next.schemaVersion);
  writeJson("hasEnteredSandbox", next.hasEnteredSandbox);
  writeJson("activeCaseId", next.activeCaseId);
  writeJson("promptOverrides", next.promptOverrides);
  writeJson("theme", next.theme);
}
