import { describe, expect, it } from "vitest";
import { sortableTranslateOnly } from "@/features/lists/lib/sortableTransform";

describe("sortableTranslateOnly", () => {
  it("returns undefined for null transform", () => {
    expect(sortableTranslateOnly(null)).toBeUndefined();
  });

  it("uses translate only and ignores scale", () => {
    const result = sortableTranslateOnly({ x: 12, y: -8, scaleX: 1.4, scaleY: 0.8 });
    expect(result).toBe("translate3d(12px, -8px, 0)");
    expect(result).not.toContain("scale");
  });
});