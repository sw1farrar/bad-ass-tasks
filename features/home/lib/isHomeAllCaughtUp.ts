/**
 * Whether the Home hub can honestly show the "all caught up" empty state.
 * Requires zero actionable items — not merely zero due-today/tomorrow tasks.
 */
export function isHomeAllCaughtUp(params: {
  attentionItemCount: number;
  upcomingFocusCount: number;
  openTasksTotal: number;
  overdueTotal: number;
  openChecklistItemsTotal: number;
}): boolean {
  return (
    params.attentionItemCount === 0 &&
    params.upcomingFocusCount === 0 &&
    params.openTasksTotal === 0 &&
    params.overdueTotal === 0 &&
    params.openChecklistItemsTotal === 0
  );
}