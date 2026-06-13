import { isImageMimeType } from "@/lib/files/isImageMimeType";

export type InlineNoteImage = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

type TipTapNode = {
  type?: string;
  attrs?: { src?: string; alt?: string; title?: string };
  content?: TipTapNode[];
};

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const MAX_INLINE_IMAGES = 5;

function parseDataUrl(dataUrl: string): { mimeType: string; dataUrl: string } | null {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), dataUrl: dataUrl.trim() };
}

function walkNodes(nodes: TipTapNode[] | undefined, out: InlineNoteImage[], index: { n: number }): void {
  if (!nodes?.length) return;

  for (const node of nodes) {
    if (out.length >= MAX_INLINE_IMAGES) return;

    if (node.type === "image" && node.attrs?.src) {
      const parsed = parseDataUrl(node.attrs.src);
      if (parsed && isImageMimeType(parsed.mimeType)) {
        index.n += 1;
        const label =
          node.attrs.title?.trim() ||
          node.attrs.alt?.trim() ||
          `inline-photo-${index.n}`;
        out.push({
          fileName: label,
          mimeType: parsed.mimeType,
          dataUrl: parsed.dataUrl,
        });
      }
    }

    if (node.content?.length) {
      walkNodes(node.content, out, index);
    }
  }
}

/** Pull embedded base64 images from TipTap note JSON (offline / demo photo notes). */
export function extractInlineNoteImages(noteContent: string | null | undefined): InlineNoteImage[] {
  const raw = noteContent?.trim();
  if (!raw || !raw.startsWith("{")) return [];

  try {
    const doc = JSON.parse(raw) as TipTapNode;
    const images: InlineNoteImage[] = [];
    walkNodes(doc.content, images, { n: 0 });
    return images;
  } catch {
    return [];
  }
}