export type PopoverVerticalPlacement = "above" | "below";
export type PopoverHorizontalAlign = "start" | "end" | "center";

export type PopoverBoundary = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type PopoverSizeMode = "constrained" | "content";

export type AnchoredPopoverPosition = {
  top: number;
  left: number;
  placement: PopoverVerticalPlacement;
  align: PopoverHorizontalAlign;
  /** Omitted in content mode — panel grows to fit all options without scrolling. */
  maxHeight?: number;
};

type ComputeAnchoredPopoverPositionArgs = {
  anchorRect: DOMRect;
  panelWidth: number;
  panelHeight: number;
  boundary: PopoverBoundary;
  margin?: number;
  gap?: number;
  horizontalAlign?: PopoverHorizontalAlign | "auto";
  sizeMode?: PopoverSizeMode;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function naturalLeftForAlign(
  align: PopoverHorizontalAlign,
  anchorRect: DOMRect,
  panelWidth: number,
): number {
  switch (align) {
    case "start":
      return anchorRect.left;
    case "end":
      return anchorRect.right - panelWidth;
    case "center":
      return anchorRect.left + anchorRect.width / 2 - panelWidth / 2;
  }
}

function resolveHorizontalAlign(
  mode: PopoverHorizontalAlign | "auto",
  anchorRect: DOMRect,
  panelWidth: number,
  boundary: PopoverBoundary,
): PopoverHorizontalAlign {
  if (mode !== "auto") return mode;

  const candidates: PopoverHorizontalAlign[] = ["start", "end", "center"];
  let bestAlign: PopoverHorizontalAlign = "start";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const align of candidates) {
    const natural = naturalLeftForAlign(align, anchorRect, panelWidth);
    const clamped = clamp(natural, boundary.left, boundary.right - panelWidth);
    const shift = Math.abs(clamped - natural);
    const score = -shift;
    if (score > bestScore) {
      bestScore = score;
      bestAlign = align;
    }
  }

  return bestAlign;
}

/** Flip above/below and shift horizontally within a boundary box. */
export function computeAnchoredPopoverPosition({
  anchorRect,
  panelWidth,
  panelHeight,
  boundary,
  margin = 8,
  gap = 6,
  horizontalAlign = "auto",
  sizeMode = "constrained",
}: ComputeAnchoredPopoverPositionArgs): AnchoredPopoverPosition {
  const align = resolveHorizontalAlign(
    horizontalAlign,
    anchorRect,
    panelWidth,
    boundary,
  );

  const spaceBelow = boundary.bottom - anchorRect.bottom - gap;
  const spaceAbove = anchorRect.top - boundary.top - gap;
  const naturalLeft = naturalLeftForAlign(align, anchorRect, panelWidth);
  const left = clamp(naturalLeft, boundary.left, boundary.right - panelWidth);

  if (sizeMode === "content") {
    let placement: PopoverVerticalPlacement = "below";

    if (panelHeight <= spaceBelow) {
      placement = "below";
    } else if (panelHeight <= spaceAbove) {
      placement = "above";
    } else {
      placement = spaceBelow >= spaceAbove ? "below" : "above";
    }

    let top =
      placement === "below"
        ? anchorRect.bottom + gap
        : anchorRect.top - panelHeight - gap;

    top = clamp(top, boundary.top, Math.max(boundary.top, boundary.bottom - panelHeight));

    return { top, left, placement, align };
  }

  const requiredHeight = panelHeight + gap;

  let placement: PopoverVerticalPlacement = "below";

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

  maxHeight = Math.min(maxHeight, panelHeight);
  maxHeight = Math.max(maxHeight, Math.min(panelHeight, 120));

  const visibleHeight = Math.min(panelHeight, maxHeight);

  let top =
    placement === "below"
      ? anchorRect.bottom + gap
      : anchorRect.top - visibleHeight - gap;

  top = clamp(
    top,
    boundary.top,
    boundary.bottom - visibleHeight,
  );

  return {
    top,
    left,
    placement,
    align,
    maxHeight,
  };
}

/** Nearest scroll/clip ancestor for table cells and nested panels. */
export function getPopoverOverflowParent(anchor: Element): Element | null {
  let node = anchor.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const combined = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
    if (/(auto|scroll|overlay|hidden)/.test(combined)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Full viewport bounds for table popovers that must float above row stacking. */
export function getViewportPopoverBoundary(margin = 8): PopoverBoundary {
  return {
    top: margin,
    left: margin,
    right: window.innerWidth - margin,
    bottom: window.innerHeight - margin,
  };
}

/** Viewport intersected with the anchor's scroll/clip container. */
export function getPopoverBoundaryRect(
  anchor: Element,
  margin = 8,
): PopoverBoundary {
  const viewport = getViewportPopoverBoundary(margin);

  const scrollParent = getPopoverOverflowParent(anchor);
  if (
    !scrollParent ||
    scrollParent === document.documentElement ||
    scrollParent === document.body
  ) {
    return viewport;
  }

  const container = scrollParent.getBoundingClientRect();
  return {
    top: Math.max(viewport.top, container.top + margin),
    left: Math.max(viewport.left, container.left + margin),
    right: Math.min(viewport.right, container.right - margin),
    bottom: Math.min(viewport.bottom, container.bottom - margin),
  };
}
