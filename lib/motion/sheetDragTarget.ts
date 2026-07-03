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

export function isSheetDragBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('textarea[readonly].list-item-text--editable')) return false;
  return Boolean(target.closest(SHEET_DRAG_BLOCKER_SELECTOR));
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

export function isListDetailTitleLabelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".list-detail-title-label"));
}