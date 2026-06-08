const MAX_PAGES = 25;
const MAX_CHARS = 120_000;

type TextItem = { str?: string };

/**
 * Best-effort PDF plain-text extraction for attachment search indexing.
 * Returns empty string on failure (never throws to callers).
 */
export async function extractPdfText(buffer: Buffer | ArrayBuffer): Promise<string> {
  try {
    const bytes =
      buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
    if (bytes.byteLength === 0) return "";

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { getDocument } = pdfjs;

    const task = getDocument({
      data: bytes,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await task.promise;

    const parts: string[] = [];
    const pageCount = Math.min(doc.numPages, MAX_PAGES);

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = (content.items as TextItem[])
        .map((item) => item.str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) parts.push(pageText);
    }

    const combined = parts.join(" ").replace(/\s+/g, " ").trim();
    return combined.length > MAX_CHARS ? combined.slice(0, MAX_CHARS) : combined;
  } catch {
    return "";
  }
}

export function isPdfMimeType(mimeType: string, fileName?: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  if (mime === "application/pdf") return true;
  return !!(fileName && /\.pdf$/i.test(fileName));
}