import { loadSettings, saveSettings } from "@/lib/storage/settings";

export type Theme = "dark" | "light";

const LISTENERS = new Set<(theme: Theme) => void>();

export function readTheme(): Theme {
  const stored = loadSettings().theme;
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f3f1eb" : "#0a0b0c");
}

export function persistTheme(theme: Theme) {
  saveSettings({ theme });
  applyTheme(theme);
  for (const listener of LISTENERS) listener(theme);
}

export function subscribeTheme(listener: (theme: Theme) => void): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}
