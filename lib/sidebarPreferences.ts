export type SidebarPinMode = "pinned" | "auto";

const STORAGE_KEY = "badazz-sidebar-pin-mode";

export function readSidebarPinMode(): SidebarPinMode {
  if (typeof window === "undefined") return "pinned";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "auto" ? "auto" : "pinned";
  } catch {
    return "pinned";
  }
}

export function writeSidebarPinMode(mode: SidebarPinMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}