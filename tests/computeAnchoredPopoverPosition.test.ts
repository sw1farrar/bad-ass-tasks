import { describe, expect, it } from "vitest";
import { computeAnchoredPopoverPosition } from "@/lib/dom/computeAnchoredPopoverPosition";

function rect(
  top: number,
  bottom: number,
  left = 100,
  width = 80,
): DOMRect {
  return {
    top,
    bottom,
    left,
    right: left + width,
    width,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

const boundary = { top: 8, left: 8, right: 992, bottom: 792 };

describe("computeAnchoredPopoverPosition", () => {
  it("opens below when there is room under the anchor", () => {
    const position = computeAnchoredPopoverPosition({
      anchorRect: rect(120, 152, 200),
      panelWidth: 220,
      panelHeight: 240,
      boundary,
      horizontalAlign: "start",
    });

    expect(position.placement).toBe("below");
    expect(position.top).toBe(158);
    expect(position.left).toBe(200);
    expect(position.align).toBe("start");
  });

  it("opens above when the anchor is near the bottom", () => {
    const position = computeAnchoredPopoverPosition({
      anchorRect: rect(700, 732, 200),
      panelWidth: 220,
      panelHeight: 240,
      boundary,
      horizontalAlign: "start",
    });

    expect(position.placement).toBe("above");
    expect(position.top).toBeLessThan(700);
  });

  it("aligns end when start would overflow the right edge", () => {
    const position = computeAnchoredPopoverPosition({
      anchorRect: rect(120, 152, 900, 80),
      panelWidth: 220,
      panelHeight: 200,
      boundary,
      horizontalAlign: "auto",
    });

    expect(position.align).toBe("end");
    expect(position.left).toBe(760);
  });

  it("clamps within a narrow boundary without overflowing", () => {
    const narrowBoundary = { top: 8, left: 8, right: 408, bottom: 792 };
    const position = computeAnchoredPopoverPosition({
      anchorRect: rect(120, 152, 180, 48),
      panelWidth: 220,
      panelHeight: 200,
      boundary: narrowBoundary,
      horizontalAlign: "auto",
    });

    expect(position.left).toBeGreaterThanOrEqual(narrowBoundary.left);
    expect(position.left + 220).toBeLessThanOrEqual(narrowBoundary.right);
  });

  it("content mode omits maxHeight and uses full panel height for placement", () => {
    const position = computeAnchoredPopoverPosition({
      anchorRect: rect(120, 152, 200),
      panelWidth: 360,
      panelHeight: 480,
      boundary,
      horizontalAlign: "start",
      sizeMode: "content",
    });

    expect(position.maxHeight).toBeUndefined();
    expect(position.placement).toBe("below");
    expect(position.top).toBe(158);
  });
});
