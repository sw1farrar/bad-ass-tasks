/** Max viewport width treated as mobile (matches `max-width: 767px` in CSS). */
export const MOBILE_MAX_WIDTH_PX = 767;

export function isMobileViewportWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH_PX;
}