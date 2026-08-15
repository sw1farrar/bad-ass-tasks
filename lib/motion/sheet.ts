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

export const SHEET_DISMISS_OFFSET = 120;
export const SHEET_DISMISS_VELOCITY = 900;
export const SHEET_DISMISS_RATIO = 0.22;
export const SHEET_DISMISS_FLICK_MIN_PX = 36;

/** Height-relative dismiss: drag ~22% of the sheet, or a real flick with min travel. */
export function shouldDismissSheet(options: {
  offsetY: number;
  velocityY: number;
  sheetHeight: number;
}): boolean {
  const offsetY = Math.max(0, options.offsetY);
  const velocityY = options.velocityY;
  const sheetHeight = Math.max(options.sheetHeight, 1);
  if (offsetY > sheetHeight * SHEET_DISMISS_RATIO) return true;
  if (offsetY > SHEET_DISMISS_FLICK_MIN_PX && velocityY > SHEET_DISMISS_VELOCITY) return true;
  if (offsetY > SHEET_DISMISS_OFFSET && velocityY > 80) return true;
  return false;
}

/** Full-viewport mobile drawer height — edge to edge at top */
export const MOBILE_SHEET_HEIGHT_CLASS = "h-[100dvh] max-h-[100dvh]";

/** 90% viewport mobile drawer — leaves peek of backdrop (preferred for forms) */
export const MOBILE_SHEET_HEIGHT_90_CLASS = "mobile-bottom-sheet--90";