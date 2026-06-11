import type { ThemeMode } from "@/lib/themePreferences";
import { LIST_COLORS } from "@/store/listSlice";

/** Google Keep–style pastels for light mode — dark palette unchanged in listSlice. */
export const LIST_COLORS_LIGHT = [
  { id: "default", label: "Default", bg: "#ffffff", border: "#e2e8f0" },
  { id: "purple", label: "Purple", bg: "#f3e8ff", border: "#ddd6fe" },
  { id: "pink", label: "Pink", bg: "#fce7f3", border: "#fbcfe8" },
  { id: "green", label: "Green", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "amber", label: "Amber", bg: "#fffbeb", border: "#fde68a" },
  { id: "blue", label: "Blue", bg: "#eff6ff", border: "#bfdbfe" },
] as const;

export function getListColorsForTheme(theme: ThemeMode) {
  return theme === "light" ? LIST_COLORS_LIGHT : LIST_COLORS;
}

export function getListColorStyleForTheme(colorId: string, theme: ThemeMode) {
  const palette = getListColorsForTheme(theme);
  return palette.find((c) => c.id === colorId) ?? palette[0];
}