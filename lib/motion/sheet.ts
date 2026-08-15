export const SHEET_SPRING = {
  type: "spring" as const,
  damping: 30,
  stiffness: 340,
  mass: 0.88,
};

/** Slide sheet fully off-screen after release (matches handle dismiss feel). */
export const SHEET_DISMISS_EXIT_SPRING = {
  type: "spring" as const,
  damping: 28,
  stiffness: 210,
  mass: 0.92,
};

/** Smooth open — ease-out tween avoids spring bounce at full height. */
export const SHEET_ENTER_TRANSITION = {
  y: {
    type: "tween" as const,
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  opacity: {
    type: "tween" as const,
    duration: 0.28,
    ease: "easeOut" as const,
  },
};

/** Snap-back after a cancelled drag. */
export const SHEET_SNAP_BACK_SPRING = {
  type: "spring" as const,
  damping: 34,
  stiffness: 380,
  mass: 0.82,
};

/** Programmatic close — ease-in tween mirrors enter curve (no spring kick at rest). */
export const SHEET_EXIT_TRANSITION = {
  type: "tween" as const,
  duration: 0.36,
  ease: [0.4, 0, 1, 1] as const,
};

export const SHEET_DISMISS_OFFSET = 80;
export const SHEET_DISMISS_VELOCITY = 700;
export const SHEET_DISMISS_RATIO = 0.15;
export const SHEET_DISMISS_FLICK_MIN_PX = 24;

/** Clear downward pull always finishes; short tugs snap back. */
export function shouldDismissSheet(options: {
  offsetY: number;
  velocityY: number;
  sheetHeight: number;
}): boolean {
  const offsetY = Math.max(0, options.offsetY);
  const velocityY = options.velocityY;
  const sheetHeight = Math.max(options.sheetHeight, 1);
  if (offsetY > sheetHeight * SHEET_DISMISS_RATIO) return true;
  if (offsetY > SHEET_DISMISS_OFFSET) return true;
  if (offsetY > SHEET_DISMISS_FLICK_MIN_PX && velocityY > SHEET_DISMISS_VELOCITY) return true;
  return false;
}

/** Full-viewport mobile drawer height — locked to the layout top. */
export const MOBILE_SHEET_HEIGHT_CLASS = "h-[100dvh] max-h-[100dvh]";

/** Unused 90% opt-in. Product drawers are full-height. */
export const MOBILE_SHEET_HEIGHT_90_CLASS = "mobile-bottom-sheet--90";