const TASK_TABLE_POPOVER_SELECTOR =
  ".tasks-table-popover, .date-picker-popover, .tasks-anchor-popover";

/** True when the click target is inside any tasks-table anchored popover panel. */
export function isClickInsideTaskTablePopover(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  const el = target instanceof Element ? target : target.parentElement;
  return !!el?.closest?.(TASK_TABLE_POPOVER_SELECTOR);
}
