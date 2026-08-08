/**
 * Decide what Enter should do while editing a list item title/body.
 * - insert: create a sibling below (caller commits dirty text first)
 * - stay: empty row — keep focus, no insert, no blur
 * - blur: commit/dismiss edit (mid-text, or insert disabled)
 */
export type ListItemEnterAction = "insert" | "stay" | "blur";

export function resolveListItemEnterAction(options: {
  insertEnabled: boolean;
  selectionStart: number;
  selectionEnd: number;
  value: string;
}): ListItemEnterAction {
  if (!options.insertEnabled) return "blur";

  const { selectionStart, selectionEnd, value } = options;
  const length = value.length;
  const cursorAtEnd = selectionStart === length && selectionEnd === length;
  // Desktop/mobile title-edit activates with select-all; treat that as insert-eligible.
  const fullSelection = length > 0 && selectionStart === 0 && selectionEnd === length;

  if (!cursorAtEnd && !fullSelection) return "blur";
  if (!value.trim()) return "stay";
  return "insert";
}
