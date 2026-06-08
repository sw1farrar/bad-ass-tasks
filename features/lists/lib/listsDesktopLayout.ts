export type ListsDesktopLayout = "grid" | "stack";

const STORAGE_KEY = "lists-desktop-layout-v1";

export function readListsDesktopLayout(): ListsDesktopLayout {
  if (typeof window === "undefined") return "grid";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "stack" ? "stack" : "grid";
}

export function writeListsDesktopLayout(layout: ListsDesktopLayout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, layout);
}