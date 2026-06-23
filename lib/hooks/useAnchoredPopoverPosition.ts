"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import {
  computeAnchoredPopoverPosition,
  getPopoverBoundaryRect,
  getViewportPopoverBoundary,
  type AnchoredPopoverPosition,
  type PopoverHorizontalAlign,
  type PopoverSizeMode,
} from "@/lib/dom/computeAnchoredPopoverPosition";

export type PopoverBoundaryMode = "container" | "viewport";

type UseAnchoredPopoverPositionArgs = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  estimatedWidth: number;
  estimatedHeight: number;
  horizontalAlign?: PopoverHorizontalAlign | "auto";
  gap?: number;
  margin?: number;
  /** Table cells use viewport so popovers aren't clipped by scroll containers. */
  boundaryMode?: PopoverBoundaryMode;
  /** Content mode expands to show all options instead of scrolling inside the panel. */
  sizeMode?: PopoverSizeMode;
};

export function useAnchoredPopoverPosition({
  open,
  anchorRef,
  panelRef,
  estimatedWidth,
  estimatedHeight,
  horizontalAlign = "auto",
  gap = 6,
  margin = 8,
  boundaryMode = "container",
  sizeMode = "constrained",
}: UseAnchoredPopoverPositionArgs): AnchoredPopoverPosition | null {
  const [position, setPosition] = useState<AnchoredPopoverPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panel = panelRef.current;
    const panelWidth = panel?.offsetWidth ?? estimatedWidth;
    const panelHeight =
      sizeMode === "content" && panel
        ? panel.scrollHeight
        : panel?.offsetHeight ?? estimatedHeight;
    const boundary =
      boundaryMode === "viewport"
        ? getViewportPopoverBoundary(margin)
        : getPopoverBoundaryRect(anchor, margin);

    setPosition(
      computeAnchoredPopoverPosition({
        anchorRect,
        panelWidth,
        panelHeight,
        boundary,
        margin,
        gap,
        horizontalAlign,
        sizeMode,
      }),
    );
  }, [
    anchorRef,
    panelRef,
    estimatedWidth,
    estimatedHeight,
    horizontalAlign,
    gap,
    margin,
    boundaryMode,
    sizeMode,
  ]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition);
    });

    return () => cancelAnimationFrame(raf);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const panel = panelRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (sizeMode === "content" && panel && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(panel);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [open, updatePosition, panelRef, sizeMode]);

  return position;
}
