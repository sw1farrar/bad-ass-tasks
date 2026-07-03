export const SHEET_SPRING = {
  type: "spring" as const,
  damping: 30,
  stiffness: 340,
  mass: 0.88,
};

export const SHEET_DISMISS_OFFSET = 120;
export const SHEET_DISMISS_VELOCITY = 520;

/** Full-viewport mobile drawer height — edge to edge at top */
export const MOBILE_SHEET_HEIGHT_CLASS = "h-[100dvh] max-h-[100dvh]";

/** 90% viewport mobile drawer — leaves peek of backdrop (preferred for forms) */
export const MOBILE_SHEET_HEIGHT_90_CLASS = "mobile-bottom-sheet--90";