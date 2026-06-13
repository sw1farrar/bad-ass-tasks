export type InlineMenuPlacement = "above" | "below";

export type InlineMenuPosition = {
  top: number;
  left: number;
  placement: InlineMenuPlacement;
  maxHeight: number;
};

type ComputeInlineMenuPositionArgs = {
  anchorRect: DOMRect;
  menuWidth: number;
  menuHeight: number;
  margin?: number;
  gap?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

export function computeInlineMenuPosition({
  anchorRect,
  menuWidth,
  menuHeight,
  margin = 8,
  gap = 6,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0,
}: ComputeInlineMenuPositionArgs): InlineMenuPosition {
  const spaceBelow = viewportHeight - anchorRect.bottom - margin;
  const spaceAbove = anchorRect.top - margin;
  const requiredHeight = menuHeight + gap;

  let placement: InlineMenuPlacement = "below";

  if (spaceBelow < requiredHeight && spaceAbove >= requiredHeight) {
    placement = "above";
  } else if (spaceAbove < requiredHeight && spaceBelow >= requiredHeight) {
    placement = "below";
  } else if (spaceBelow < requiredHeight && spaceAbove < requiredHeight) {
    placement = spaceAbove > spaceBelow ? "above" : "below";
  }

  let maxHeight =
    placement === "below"
      ? Math.max(spaceBelow - gap, margin)
      : Math.max(spaceAbove - gap, margin);

  maxHeight = Math.min(maxHeight, menuHeight);

  let top =
    placement === "below"
      ? anchorRect.bottom + gap
      : anchorRect.top - Math.min(menuHeight, maxHeight) - gap;

  top = Math.max(margin, Math.min(top, viewportHeight - Math.min(menuHeight, maxHeight) - margin));

  let left = anchorRect.right - menuWidth;
  left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));

  return {
    top,
    left,
    placement,
    maxHeight: Math.max(maxHeight, 120),
  };
}