/** True when a modal/dialog is open — page shortcuts should not steal Escape. */
export function hasOpenOverlay(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"]',
  );
}