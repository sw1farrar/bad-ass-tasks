import { describe, expect, it } from "vitest";
import {
  getListDragScrollStep,
  LIST_DRAG_SCROLL_EDGE_PX,
  LIST_DRAG_SCROLL_MAX_STEP,
} from "@/features/lists/lib/listDragAutoScroll";

function mockScrollContainer(options: {
  top?: number;
  height?: number;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
}) {
  const {
    top = 0,
    height = 600,
    scrollTop = 100,
    scrollHeight = 1200,
    clientHeight = 600,
  } = options;

  return {
    getBoundingClientRect: () => ({
      top,
      bottom: top + height,
      left: 0,
      right: 320,
      width: 320,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
    scrollTop,
    scrollHeight,
    clientHeight,
  } as unknown as HTMLElement;
}

describe("getListDragScrollStep", () => {
  it("scrolls up when the pointer is near the top edge", () => {
    const container = mockScrollContainer({ top: 64, scrollTop: 120 });
    const step = getListDragScrollStep(64 + 20, container);
    expect(step).toBeLessThan(0);
    expect(step).toBeGreaterThanOrEqual(-LIST_DRAG_SCROLL_MAX_STEP);
  });

  it("scrolls down when the pointer is near the bottom edge", () => {
    const container = mockScrollContainer({ top: 64, scrollTop: 120 });
    const step = getListDragScrollStep(64 + 600 - 20, container);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThanOrEqual(LIST_DRAG_SCROLL_MAX_STEP);
  });

  it("does not scroll when already at the top", () => {
    const container = mockScrollContainer({ top: 64, scrollTop: 0 });
    expect(getListDragScrollStep(64 + 10, container)).toBe(0);
  });

  it("does not scroll in the middle of the viewport", () => {
    const container = mockScrollContainer({ top: 64, scrollTop: 120 });
    expect(getListDragScrollStep(64 + LIST_DRAG_SCROLL_EDGE_PX + 40, container)).toBe(0);
  });
});