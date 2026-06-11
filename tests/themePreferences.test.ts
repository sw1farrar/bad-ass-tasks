import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_THEME,
  normalizeThemeMode,
  readThemeMode,
  writeThemeMode,
  applyThemeToDocument,
} from "@/lib/themePreferences";

describe("themePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = DEFAULT_THEME;
    document.documentElement.classList.add("dark");
  });

  it("normalizeThemeMode falls back to dark", () => {
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("system")).toBe(DEFAULT_THEME);
  });

  it("read/write roundtrip via dedicated key", () => {
    writeThemeMode("light");
    expect(readThemeMode()).toBe("light");
  });

  it("applyThemeToDocument sets dataset and dark class", () => {
    applyThemeToDocument("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    applyThemeToDocument("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});