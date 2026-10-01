export type ListItemCaretPlacement = "select-all" | "end";

/**
 * iOS often selects the whole textarea after a programmatic focus, including
 * once the keyboard starts opening. Recheck at these delays and collapse a
 * select-all that is still sitting there. A caret the user has already moved
 * is left alone.
 */
export const LIST_ITEM_CARET_IOS_FIX_DELAYS_MS = [60, 240] as const;

/** Mobile detail editing starts at the end. Desktop detail keeps select-all. */
export function listItemCaretPlacement(mobileDetail: boolean): ListItemCaretPlacement {
  return mobileDetail ? "end" : "select-all";
}

export function listItemCaretRange(
  valueLength: number,
  placement: ListItemCaretPlacement,
): { start: number; end: number } {
  const length = Math.max(0, valueLength);
  if (placement === "end") return { start: length, end: length };
  return { start: 0, end: length };
}

export function isFullTextSelection(
  valueLength: number,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  return valueLength > 0 && selectionStart === 0 && selectionEnd === valueLength;
}
