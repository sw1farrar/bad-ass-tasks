export type PdfHighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfHighlightAnnotation = {
  id: string;
  page: number;
  color: string;
  rects: PdfHighlightRect[];
  text?: string;
  createdAt: string;
};

export const PDF_HIGHLIGHT_COLORS = [
  { id: "yellow", value: "rgba(250, 204, 21, 0.45)", label: "Yellow" },
  { id: "green", value: "rgba(74, 222, 128, 0.4)", label: "Green" },
  { id: "pink", value: "rgba(244, 114, 182, 0.4)", label: "Pink" },
] as const;

export function createHighlightId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeClientRects(
  rects: DOMRectList | DOMRect[],
  pageWidth: number,
  pageHeight: number,
  pageLeft: number,
  pageTop: number,
): PdfHighlightRect[] {
  const list = Array.from(rects as DOMRectList);
  return list
    .map((rect) => {
      const x = (rect.left - pageLeft) / pageWidth;
      const y = (rect.top - pageTop) / pageHeight;
      const width = rect.width / pageWidth;
      const height = rect.height / pageHeight;
      return { x, y, width, height };
    })
    .filter((r) => r.width > 0.002 && r.height > 0.002);
}

/** Convert a drag box on a page (pixel coords) to normalized highlight geometry. */
export function normalizeAreaRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pageWidth: number,
  pageHeight: number,
): PdfHighlightRect[] {
  if (pageWidth <= 0 || pageHeight <= 0) return [];

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const rect = {
    x: left / pageWidth,
    y: top / pageHeight,
    width: width / pageWidth,
    height: height / pageHeight,
  };

  if (rect.width <= 0.002 || rect.height <= 0.002) return [];
  return [rect];
}

export function annotationsEqual(
  a: PdfHighlightAnnotation[],
  b: PdfHighlightAnnotation[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function parsePdfAnnotations(raw: unknown): PdfHighlightAnnotation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PdfHighlightAnnotation =>
      !!item &&
      typeof item === "object" &&
      typeof (item as PdfHighlightAnnotation).id === "string" &&
      typeof (item as PdfHighlightAnnotation).page === "number" &&
      Array.isArray((item as PdfHighlightAnnotation).rects),
  );
}