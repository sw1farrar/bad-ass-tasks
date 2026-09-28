import { describe, expect, it } from "vitest";
import { keyboardOverlapPx } from "@/lib/hooks/useVisualViewportInsets";

describe("keyboardOverlapPx", () => {
  it("returns the band covered when the keyboard overlays a full layout viewport", () => {
    expect(keyboardOverlapPx(800, 500, 0)).toBe(300);
  });

  it("shrinks the overlap when the visual viewport has panned down", () => {
    expect(keyboardOverlapPx(800, 500, 40)).toBe(260);
  });

  it("returns 0 once the layout viewport has already shrunk to the visual viewport", () => {
    expect(keyboardOverlapPx(500, 500, 0)).toBe(0);
  });

  it("never returns a negative overlap", () => {
    expect(keyboardOverlapPx(480, 500, 20)).toBe(0);
  });
});
