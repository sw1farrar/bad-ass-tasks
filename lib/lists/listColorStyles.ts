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

/** Richer mobile/card backgrounds with guaranteed readable text tokens. */
const LIST_COLORS_LIGHT_VIBRANT: Record<
  string,
  { bg: string; border: string; titleColor: string; metaColor: string; itemTextColor: string; checkBorder: string }
> = {
  default: {
    bg: "#ffffff",
    border: "#e2e8f0",
    titleColor: "#0f172a",
    metaColor: "#64748b",
    itemTextColor: "#475569",
    checkBorder: "#cbd5e1",
  },
  purple: {
    bg: "#ede9fe",
    border: "#c4b5fd",
    titleColor: "#1e1b4b",
    metaColor: "#6d28d9",
    itemTextColor: "#3730a3",
    checkBorder: "#a78bfa",
  },
  pink: {
    bg: "#fce7f3",
    border: "#f9a8d4",
    titleColor: "#831843",
    metaColor: "#be185d",
    itemTextColor: "#9d174d",
    checkBorder: "#f472b6",
  },
  green: {
    bg: "#d1fae5",
    border: "#6ee7b7",
    titleColor: "#064e3b",
    metaColor: "#047857",
    itemTextColor: "#065f46",
    checkBorder: "#34d399",
  },
  amber: {
    bg: "#fef3c7",
    border: "#fcd34d",
    titleColor: "#78350f",
    metaColor: "#b45309",
    itemTextColor: "#92400e",
    checkBorder: "#fbbf24",
  },
  blue: {
    bg: "#dbeafe",
    border: "#93c5fd",
    titleColor: "#1e3a8a",
    metaColor: "#1d4ed8",
    itemTextColor: "#1e40af",
    checkBorder: "#60a5fa",
  },
};

const LIST_COLORS_DARK_VIBRANT: Record<
  string,
  { bg: string; border: string; titleColor: string; metaColor: string; itemTextColor: string; checkBorder: string }
> = {
  default: {
    bg: "#1c1c22",
    border: "rgba(255,255,255,0.14)",
    titleColor: "#f8fafc",
    metaColor: "rgba(248, 250, 252, 0.58)",
    itemTextColor: "rgba(248, 250, 252, 0.86)",
    checkBorder: "rgba(255,255,255,0.32)",
  },
  purple: {
    bg: "rgba(124, 58, 237, 0.28)",
    border: "rgba(167, 139, 250, 0.48)",
    titleColor: "#faf5ff",
    metaColor: "rgba(233, 213, 255, 0.72)",
    itemTextColor: "rgba(245, 243, 255, 0.9)",
    checkBorder: "rgba(196, 181, 253, 0.55)",
  },
  pink: {
    bg: "rgba(236, 72, 153, 0.22)",
    border: "rgba(244, 114, 182, 0.42)",
    titleColor: "#fdf2f8",
    metaColor: "rgba(251, 207, 232, 0.72)",
    itemTextColor: "rgba(253, 242, 248, 0.9)",
    checkBorder: "rgba(244, 114, 182, 0.5)",
  },
  green: {
    bg: "rgba(16, 185, 129, 0.2)",
    border: "rgba(52, 211, 153, 0.4)",
    titleColor: "#ecfdf5",
    metaColor: "rgba(167, 243, 208, 0.72)",
    itemTextColor: "rgba(236, 253, 245, 0.9)",
    checkBorder: "rgba(52, 211, 153, 0.48)",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.2)",
    border: "rgba(251, 191, 36, 0.42)",
    titleColor: "#fffbeb",
    metaColor: "rgba(253, 230, 138, 0.72)",
    itemTextColor: "rgba(254, 243, 199, 0.92)",
    checkBorder: "rgba(251, 191, 36, 0.5)",
  },
  blue: {
    bg: "rgba(59, 130, 246, 0.22)",
    border: "rgba(96, 165, 250, 0.44)",
    titleColor: "#eff6ff",
    metaColor: "rgba(191, 219, 254, 0.72)",
    itemTextColor: "rgba(219, 234, 254, 0.92)",
    checkBorder: "rgba(96, 165, 250, 0.5)",
  },
};

export type ListColorPresentation = {
  bg: string;
  border: string;
  titleColor: string;
  metaColor: string;
  itemTextColor: string;
  checkBorder: string;
  /** Elevated row / chip surface — lighter than canvas bg */
  itemSurface: string;
  /** Grouped family container surface */
  familySurface: string;
  /** Header band tint */
  headerBand: string;
  /** Add-item composer field */
  addItemSurface: string;
  /** Focused inputs, title fields, and active rows */
  focusSurface: string;
  /** Checkboxes, add-item icon circles */
  controlSurface: string;
  /** Focus rings and active borders */
  focusBorder: string;
  /** Portaled row action menu */
  menuSurface: string;
  /** Placeholders, hints, dividers */
  placeholderColor: string;
  /** Completed item text */
  doneTextColor: string;
  /** Secondary icons and chrome */
  iconColor: string;
};

/** Dark app card surface — used to flatten translucent list tints for full-screen drawers. */
const DARK_DRAWER_BASE = "#1a1a1f";

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(color: string): Rgba {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: parts[3] !== undefined ? Number(parts[3]) : 1,
    };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function toHex({ r, g, b }: Pick<Rgba, "r" | "g" | "b">): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Blend two colors; `weightA` is the proportion of the first color (0–1). */
export function mixColors(colorA: string, colorB: string, weightA: number): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const inverse = 1 - weightA;
  return toHex({
    r: a.r * weightA + b.r * inverse,
    g: a.g * weightA + b.g * inverse,
    b: a.b * weightA + b.b * inverse,
  });
}

/** Flatten translucent list colors over a solid surface for opaque mobile drawers. */
export function flattenColorOverBackground(color: string, background = DARK_DRAWER_BASE): string {
  const fg = parseColor(color);
  const bg = parseColor(background);
  if (fg.a >= 1) return toHex(fg);

  const inverse = 1 - fg.a;
  return toHex({
    r: fg.r * fg.a + bg.r * inverse,
    g: fg.g * fg.a + bg.g * inverse,
    b: fg.b * fg.a + bg.b * inverse,
  });
}

function buildListSurfaces(
  base: {
    bg: string;
    border: string;
    titleColor: string;
    metaColor: string;
    itemTextColor: string;
    checkBorder: string;
  },
  theme: ThemeMode,
) {
  const effectiveCanvas =
    theme === "dark" ? flattenColorOverBackground(base.bg) : base.bg;
  const effectiveBorder =
    theme === "dark" ? flattenColorOverBackground(base.border) : base.border;

  const itemSurface = mixColors(effectiveCanvas, "#ffffff", 0.94);
  const focusBlend = theme === "light" ? 0.22 : 0.52;
  const controlBlend = theme === "light" ? 0.45 : 0.35;

  return {
    itemSurface,
    familySurface: mixColors(effectiveCanvas, "#ffffff", 0.92),
    headerBand: mixColors(effectiveCanvas, effectiveBorder, 0.7),
    addItemSurface: itemSurface,
    focusSurface: mixColors(effectiveCanvas, "#ffffff", focusBlend),
    controlSurface: itemSurface,
    focusBorder: mixColors(
      effectiveBorder,
      theme === "light" ? "#334155" : "#d4d4d8",
      theme === "light" ? 0.42 : 0.5,
    ),
    menuSurface: mixColors(effectiveCanvas, "#ffffff", theme === "light" ? 0.96 : 0.88),
    placeholderColor: base.metaColor,
    doneTextColor: base.metaColor,
    iconColor: base.metaColor,
  };
}

export type ListColorPresentationOptions = {
  /** Use fully opaque surfaces (required for full-screen mobile drawers). */
  opaque?: boolean;
};

export function getListColorsForTheme(theme: ThemeMode) {
  return theme === "light" ? LIST_COLORS_LIGHT : LIST_COLORS;
}

export function getListColorStyleForTheme(colorId: string, theme: ThemeMode) {
  const palette = getListColorsForTheme(theme);
  return palette.find((c) => c.id === colorId) ?? palette[0];
}

export function getListColorPresentation(
  colorId: string,
  theme: ThemeMode,
  options?: ListColorPresentationOptions,
): ListColorPresentation {
  const vibrant = theme === "light" ? LIST_COLORS_LIGHT_VIBRANT : LIST_COLORS_DARK_VIBRANT;
  const base = vibrant[colorId] ?? vibrant.default;
  const surfaces = buildListSurfaces(base, theme);

  if (options?.opaque && theme === "dark") {
    return {
      ...base,
      bg: flattenColorOverBackground(base.bg),
      border: flattenColorOverBackground(base.border),
      checkBorder: flattenColorOverBackground(base.checkBorder),
      ...surfaces,
    };
  }

  return {
    ...base,
    ...surfaces,
  };
}

/** Shared CSS custom properties for list cards and detail drawers. */
export function listColorPresentationStyleVars(
  presentation: ListColorPresentation,
): Record<string, string> {
  return {
    ["--list-bg"]: presentation.bg,
    ["--list-border"]: presentation.border,
    ["--list-chip-bg"]: presentation.bg,
    ["--list-chip-border"]: presentation.border,
    ["--list-title-color"]: presentation.titleColor,
    ["--list-meta-color"]: presentation.metaColor,
    ["--list-item-text-color"]: presentation.itemTextColor,
    ["--list-check-border"]: presentation.checkBorder,
    ["--list-item-surface"]: presentation.itemSurface,
    ["--list-family-surface"]: presentation.familySurface,
    ["--list-header-band"]: presentation.headerBand,
    ["--list-add-item-surface"]: presentation.addItemSurface,
    ["--list-focus-surface"]: presentation.focusSurface,
    ["--list-control-surface"]: presentation.controlSurface,
    ["--list-focus-border"]: presentation.focusBorder,
    ["--list-menu-surface"]: presentation.menuSurface,
    ["--list-text-color"]: presentation.itemTextColor,
    ["--list-placeholder-color"]: presentation.placeholderColor,
    ["--list-done-text-color"]: presentation.doneTextColor,
    ["--list-icon-color"]: presentation.iconColor,
  };
}

/** CSS variable names propagated to portaled list menus. */
export const LIST_THEME_CSS_VAR_KEYS = [
  "--list-bg",
  "--list-border",
  "--list-title-color",
  "--list-meta-color",
  "--list-item-text-color",
  "--list-check-border",
  "--list-item-surface",
  "--list-family-surface",
  "--list-header-band",
  "--list-add-item-surface",
  "--list-focus-surface",
  "--list-control-surface",
  "--list-focus-border",
  "--list-menu-surface",
  "--list-text-color",
  "--list-placeholder-color",
  "--list-done-text-color",
  "--list-icon-color",
] as const;

export function readListThemeVarsFromElement(
  element: Element | null | undefined,
): Record<string, string> {
  if (!element || typeof window === "undefined") return {};
  const source = element.closest<HTMLElement>(
    "[data-list-color], .list-card, .list-detail-modal",
  );
  if (!source) return {};

  const computed = getComputedStyle(source);
  const vars: Record<string, string> = {};
  for (const key of LIST_THEME_CSS_VAR_KEYS) {
    const value = computed.getPropertyValue(key).trim();
    if (value) vars[key] = value;
  }
  return vars;
}