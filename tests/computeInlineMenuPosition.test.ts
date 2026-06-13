import { describe, expect, it } from "vitest";
import { computeInlineMenuPosition } from "@/lib/lists/computeInlineMenuPosition";

function rect(top: number, bottom: number, right = 320): DOMRect {
  return {
    top,
    bottom,
    left: right - 40,
    right,
    width: 40,
    height: bottom - top,
    x: right - 40,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("computeInlineMenuPosition", () => {
  const menuWidth = 216;
  const menuHeight = 280;

  it("opens below when there is room under the anchor", () => {
    const position = computeInlineMenuPosition({
      anchorRect: rect(120, 152),
      menuWidth,
      menuHeight,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(position.placement).toBe("below");
    expect(position.top).toBe(158);
  });

  it("opens above when the anchor is near the bottom", () => {
    const position = computeInlineMenuPosition({
      anchorRect: rect(760, 792),
      menuWidth,
      menuHeight,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(position.placement).toBe("above");
    expect(position.top).toBeLessThan(760);
  });

  it("opens below when the anchor is near the top", () => {
    const position = computeInlineMenuPosition({
      anchorRect: rect(24, 56),
      menuWidth,
      menuHeight,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(position.placement).toBe("below");
    expect(position.top).toBe(62);
  });
});