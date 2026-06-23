/** True when the app is running installed (Add to Home Screen / PWA), not in the browser chrome. */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}