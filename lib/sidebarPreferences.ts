export type SidebarDisplayMode = "expanded" | "hover-expand" | "icons-only";

const STORAGE_KEY = "badazz-sidebar-display-mode";
const LEGACY_STORAGE_KEY = "badazz-sidebar-pin-mode";

function normalizeMode(raw: string | null): SidebarDisplayMode {
  if (raw === "expanded" || raw === "hover-expand" || raw === "icons-only") {
    return raw;
  }
  if (raw === "pinned") return "expanded";
  if (raw === "auto") return "hover-expand";
  return "expanded";
}

export function readSidebarDisplayMode(): SidebarDisplayMode {
  if (typeof window === "undefined") return "expanded";
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeMode(current);

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = normalizeMode(legacy);
      writeSidebarDisplayMode(migrated);
      return migrated;
    }

    return "expanded";
  } catch {
    return "expanded";
  }
}

export function writeSidebarDisplayMode(mode: SidebarDisplayMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

/** @deprecated Use SidebarDisplayMode */
export type SidebarPinMode = SidebarDisplayMode;

/** @deprecated Use readSidebarDisplayMode */
export const readSidebarPinMode = readSidebarDisplayMode;

/** @deprecated Use writeSidebarDisplayMode */
export const writeSidebarPinMode = writeSidebarDisplayMode;

export const SIDEBAR_DISPLAY_OPTIONS: Array<{
  mode: SidebarDisplayMode;
  label: string;
  description: string;
}> = [
  {
    mode: "expanded",
    label: "Always expanded",
    description: "Full sidebar with labels at all times",
  },
  {
    mode: "hover-expand",
    label: "Expand on hover",
    description: "Icon rail that opens when you hover the sidebar",
  },
  {
    mode: "icons-only",
    label: "Icons only",
    description: "Stay collapsed; tooltips show labels on hover",
  },
];