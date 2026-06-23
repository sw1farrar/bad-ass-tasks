"use client";

import { useEffect } from "react";
import { applyThemeToDocument, readThemeMode } from "@/lib/themePreferences";
import { useTaskStore } from "@/store/useTaskStore";

/** Keeps document theme in sync with persisted store preference after hydration. */
export function ThemeProvider() {
  const theme = useTaskStore((s) => s.theme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "badazz-theme" && event.key !== "badazz-tasks-storage") return;
      const next = readThemeMode();
      const current = useTaskStore.getState().theme;
      if (next !== current) {
        useTaskStore.getState().setTheme(next, { persist: false });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}