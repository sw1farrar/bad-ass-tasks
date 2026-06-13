export const SHEET_SPRING = {
  type: "spring" as const,
  damping: 30,
  stiffness: 340,
  mass: 0.88,
};

export const SHEET_DISMISS_OFFSET = 100;
export const SHEET_DISMISS_VELOCITY = 480;

/** Full-viewport mobile drawer height — edge to edge at top */
export const MOBILE_SHEET_HEIGHT_CLASS = "h-[100dvh] max-h-[100dvh]";