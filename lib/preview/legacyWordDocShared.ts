export type LegacyWordDocPreview = {
  body: string;
  footnotes: string;
  endnotes: string;
};

export type WordDocumentFormat = "docx" | "legacy-doc" | "rtf" | "html-word" | "unknown";

type BinaryLike = ArrayBuffer | Buffer | Uint8Array;

function binaryBytes(buffer: BinaryLike): Uint8Array {
  if (buffer instanceof Uint8Array) return buffer;
  if (Buffer.isBuffer(buffer)) return buffer;
  return new Uint8Array(buffer);
}

/** ZIP archive header (.docx / .xlsx / other Office Open XML packages). */
export function isZipArchive(buffer: BinaryLike): boolean {
  const view = binaryBytes(buffer);
  return (
    view.length >= 4 &&
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07)
  );
}

/** OLE compound document header (legacy .doc / older Office binaries). */
export function isOleCompoundFile(buffer: BinaryLike): boolean {
  const view = binaryBytes(buffer);
  return (
    view.length >= 4 &&
    view[0] === 0xd0 &&
    view[1] === 0xcf &&
    view[2] === 0x11 &&
    view[3] === 0xe0
  );
}

/** Prefer file contents over extension/MIME when choosing a Word preview path. */
export function detectWordDocumentFormat(buffer: BinaryLike): WordDocumentFormat {
  if (isZipArchive(buffer)) return "docx";
  if (isOleCompoundFile(buffer)) return "legacy-doc";

  const sample = binaryBytes(buffer).subarray(0, Math.min(binaryBytes(buffer).length, 512));
  const text = Buffer.from(sample).toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();
  if (text.startsWith("{\\rtf")) return "rtf";
  if (
    text.startsWith("<") &&
    (text.includes("<html") ||
      text.includes("<!doctype") ||
      text.includes("schemas-microsoft-com:office:word"))
  ) {
    return "html-word";
  }

  return "unknown";
}

export function legacyWordBodyToParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\r?\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}