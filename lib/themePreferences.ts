export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "badazz-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME;
}

export function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const direct = localStorage.getItem(THEME_STORAGE_KEY);
    if (direct) return normalizeThemeMode(direct);

    const persisted = localStorage.getItem("badazz-tasks-storage");
    if (persisted) {
      const parsed = JSON.parse(persisted) as { state?: { theme?: unknown } };
      const fromStore = parsed?.state?.theme;
      if (isThemeMode(fromStore)) return fromStore;
    }
  } catch {
    // ignore parse / quota errors
  }
  return DEFAULT_THEME;
}

export function writeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", mode === "dark" ? "#0a0a0f" : "#f8fafc");
  }
}

export const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; description: string }> = [
  { mode: "dark", label: "Dark", description: "Neon dark — default" },
  { mode: "light", label: "Light", description: "Clean bright workspace" },
];