/** Edge zone (px) inside the scroll container viewport that triggers auto-scroll. */
export const LIST_DRAG_SCROLL_EDGE_PX = 88;

/** Max scroll step per animation frame while dragging near an edge. */
export const LIST_DRAG_SCROLL_MAX_STEP = 18;

export function findListPageScrollContainer(): HTMLElement | null {
  const main = document.querySelector<HTMLElement>("main.main-content");
  if (!main?.querySelector(".lists-root")) return null;
  return main;
}

/** Returns signed scroll delta for one frame, or 0 when not near an edge. */
export function getListDragScrollStep(
  clientY: number,
  scrollContainer: HTMLElement,
): number {
  const rect = scrollContainer.getBoundingClientRect();
  const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
  if (maxScroll <= 0) return 0;

  const distanceFromTop = clientY - rect.top;
  if (distanceFromTop < LIST_DRAG_SCROLL_EDGE_PX && scrollContainer.scrollTop > 0) {
    const intensity = 1 - Math.max(0, distanceFromTop) / LIST_DRAG_SCROLL_EDGE_PX;
    return -Math.ceil(LIST_DRAG_SCROLL_MAX_STEP * intensity);
  }

  const distanceFromBottom = rect.bottom - clientY;
  if (distanceFromBottom < LIST_DRAG_SCROLL_EDGE_PX && scrollContainer.scrollTop < maxScroll - 1) {
    const intensity = 1 - Math.max(0, distanceFromBottom) / LIST_DRAG_SCROLL_EDGE_PX;
    return Math.ceil(LIST_DRAG_SCROLL_MAX_STEP * intensity);
  }

  return 0;
}

export function applyListDragEdgeScroll(clientY: number): void {
  const container = findListPageScrollContainer();
  if (!container) return;
  const step = getListDragScrollStep(clientY, container);
  if (step !== 0) container.scrollTop += step;
}