/** Space kept between the edited row and the keyboard or the top of the list. */
export const LIST_EDITOR_KEYBOARD_GAP_PX = 12;

/**
 * How far to move the list scroller so the edited row sits fully inside the
 * visible band. Positive scrolls the row up (it was under the keyboard or
 * below the fold). A row taller than the band is pinned to the bottom so the
 * last lines stay uncovered.
 */
export function editorScrollDelta(options: {
  editorTop: number;
  editorBottom: number;
  visibleTop: number;
  visibleBottom: number;
  gap?: number;
}): number {
  const gap = options.gap ?? LIST_EDITOR_KEYBOARD_GAP_PX;
  const topLimit = options.visibleTop + gap;
  const bottomLimit = options.visibleBottom - gap;
  if (bottomLimit <= topLimit) {
    return options.editorBottom - options.visibleBottom;
  }
  const bottomOverflow = options.editorBottom - bottomLimit;
  if (bottomOverflow > 1) return bottomOverflow;
  const topOverflow = topLimit - options.editorTop;
  if (topOverflow > 1) return -topOverflow;
  return 0;
}

/** Scroll the open list so the focused row is fully above the keyboard. */
export function scrollListEditorAboveKeyboard(editor: HTMLElement, scroller: HTMLElement) {
  const row = editor.closest<HTMLElement>(".list-item-row") ?? editor;
  const vv = window.visualViewport;
  const visualTop = vv ? vv.offsetTop : 0;
  const visualBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const scrollerRect = scroller.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const delta = editorScrollDelta({
    editorTop: rowRect.top,
    editorBottom: rowRect.bottom,
    visibleTop: Math.max(scrollerRect.top, visualTop),
    visibleBottom: Math.min(scrollerRect.bottom, visualBottom),
  });
  if (delta === 0) return;
  const previous = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = "auto";
  scroller.scrollTop += delta;
  scroller.style.scrollBehavior = previous;
}
