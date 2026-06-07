import { describe, it, expect } from "vitest";
import {
  annotationsEqual,
  createHighlightId,
  normalizeAreaRect,
  normalizeClientRects,
  parsePdfAnnotations,
} from "@/lib/pdf/annotations";

describe("pdfAnnotations", () => {
  it("parses valid annotation arrays", () => {
    const parsed = parsePdfAnnotations([
      {
        id: "hl_1",
        page: 1,
        color: "yellow",
        rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
        createdAt: "2026-06-07T00:00:00.000Z",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].page).toBe(1);
  });

  it("rejects invalid annotation payloads", () => {
    expect(parsePdfAnnotations(null)).toEqual([]);
    expect(parsePdfAnnotations([{ id: "x" }])).toEqual([]);
  });

  it("normalizes DOM rects to page-relative fractions", () => {
    const rects = normalizeClientRects(
      [{ left: 110, top: 210, width: 50, height: 12 } as DOMRect],
      200,
      400,
      100,
      200,
    );
    expect(rects[0]).toMatchObject({
      x: 0.05,
      y: 0.025,
      width: 0.25,
      height: 0.03,
    });
  });

  it("normalizes drag boxes to page-relative fractions", () => {
    const rects = normalizeAreaRect(20, 40, 120, 90, 400, 800);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({
      x: 0.05,
      y: 0.05,
      width: 0.25,
      height: 0.0625,
    });
  });

  it("ignores tiny drag boxes", () => {
    expect(normalizeAreaRect(10, 10, 10.5, 10.5, 400, 800)).toEqual([]);
  });

  it("compares annotation sets", () => {
    const a = [{ id: createHighlightId(), page: 1, color: "y", rects: [], createdAt: "" }];
    const b = [...a];
    expect(annotationsEqual(a, b)).toBe(true);
  });
});