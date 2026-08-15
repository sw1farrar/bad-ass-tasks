export const SHEET_DRAG_BLOCKER_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  '[contenteditable="true"]',
  ".list-item-actions-menu",
  ".list-item-check",
  ".list-item-menu",
  ".list-item-pending-btn",
  '[data-sheet-drag-block="true"]',
].join(", ");

/** Item-like components — swipe should not steal these, even on non-interactive text. */
export const SHEET_DRAG_COMPONENT_SELECTOR = [
  ".list-item-row",
  ".list-add-item-row",
  ".list-add-item-composer",
  ".list-detail-toolbar",
  ".list-completed-divider",
  ".chat-message-item",
  ".chat-message-bubble",
  ".chat-composer",
  ".chat-conversation-item",
  ".ProseMirror",
  ".tiptap",
  '[data-sheet-drag-block="true"]',
].join(", ");

export function isSheetDragBlockedTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return true;
  if (el.closest('textarea[readonly].list-item-text--editable')) return false;
  return Boolean(el.closest(SHEET_DRAG_BLOCKER_SELECTOR));
}

/** Empty chrome, padding, and gaps — not controls and not item/component rows. */
export function isSheetBlankDragTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  if (isSheetDragBlockedTarget(el)) return false;
  if (el.closest(SHEET_DRAG_COMPONENT_SELECTOR)) return false;
  return true;
}

/** Only a focused text field should refuse to arm a sheet drag. */
export function isFocusedSheetEditor(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  const field = el.closest("input, textarea:not([readonly]), [contenteditable='true']");
  if (!(field instanceof HTMLElement)) return false;
  return document.activeElement === field || field.contains(document.activeElement);
}

/** Open-item list body in the mobile list detail drawer — excludes toolbar, add row, completed section. */
export function isActiveListDetailDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(".list-detail-scroll")) return false;
  if (target.closest(".list-detail-toolbar, .list-add-item-row")) return false;
  if (target.closest(".list-item-row--completed-section, .list-completed-divider")) return false;
  if (isSheetDragBlockedTarget(target)) return false;
  return true;
}

/** Full mobile list detail sheet — any non-interactive surface inside the modal. */
export function isListDetailSheetDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(".list-detail-modal-surface")) return false;
  if (isSheetDragBlockedTarget(target)) return false;
  return true;
}

/** Header band in the mobile list detail drawer — excludes icon buttons and menus. */
export function isListDetailHeaderDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(".list-header-band")) return false;
  if (target.closest(".list-detail-header-actions, .list-header-btn")) return false;
  if (isSheetDragBlockedTarget(target)) return false;
  return true;
}

/** List drawer swipe: header chrome and empty space, never list items or other components. */
export function isListDetailBlankDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(".list-detail-modal-surface")) return false;
  if (target.closest(".list-detail-header-actions, .list-header-btn")) return false;
  return isSheetBlankDragTarget(target);
}

export function isListDetailTitleLabelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".list-detail-title-label"));
}