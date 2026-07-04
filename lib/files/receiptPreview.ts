import type { FilePreviewTarget } from "@/components/FilePreviewModal";
import type { PdfHighlightAnnotation } from "@/lib/pdf/annotations";
import type { ReceiptLineItemRecord } from "@/lib/files/receiptLineItems";
import { buildEmailShadowContent } from "@/lib/notes/emailDocument";
import {
  fetchNoteAttachments,
  type CachedNoteAttachment,
} from "@/lib/notes/noteAttachmentListCache";
import {
  displayStoredEmailHtml,
  prepareInboundEmailHtml,
} from "@/lib/notes/sanitizeInboundEmailHtml";
import { isPdfMimeType } from "@/lib/pdf/extractPdfText";
import type { Note } from "@/types";

export type ReceiptPreviewCatalogEntry = {
  noteId: string;
  label: string;
};

export type ReceiptPreviewSlide = {
  noteId: string;
  label: string;
  target: FilePreviewTarget;
  receiptIndex: number;
  imageIndex: number;
  receiptImageCount: number;
  receiptCount: number;
};

export type ReceiptEmailPreviewContent = {
  title: string;
  bodyHtml: string;
  css: string;
  plainTextFallback?: string;
};

type EmailHtmlBlockAttrs = {
  html?: string;
  styles?: string;
  pipelineVersion?: number | null;
};

function findEmailHtmlBlock(content: string): EmailHtmlBlockAttrs | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      type?: string;
      content?: unknown[];
    };
    if (parsed.type !== "doc" || !Array.isArray(parsed.content)) return null;

    const walk = (nodes: unknown[]): EmailHtmlBlockAttrs | null => {
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const n = node as {
          type?: string;
          attrs?: EmailHtmlBlockAttrs;
          content?: unknown[];
        };
        if (n.type === "emailHtmlBlock") return n.attrs ?? {};
        if (Array.isArray(n.content)) {
          const nested = walk(n.content);
          if (nested) return nested;
        }
      }
      return null;
    };

    return walk(parsed.content);
  } catch {
    return null;
  }
}

function extractPlainTextFallback(
  note: Pick<Note, "content" | "searchPlain" | "title">,
): string | null {
  const searchPlain = note.searchPlain?.trim();
  if (searchPlain) return searchPlain;

  const content = note.content?.trim();
  if (!content) return null;
  if (!content.startsWith("{")) return content;

  try {
    const parsed = JSON.parse(content) as { content?: unknown[] };
    const parts: string[] = [];
    const walk = (nodes: unknown[]) => {
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const n = node as { type?: string; text?: string; content?: unknown[] };
        if (typeof n.text === "string") parts.push(n.text);
        if (Array.isArray(n.content)) walk(n.content);
      }
    };
    if (Array.isArray(parsed.content)) walk(parsed.content);
    const joined = parts.join("\n").trim();
    return joined || null;
  } catch {
    return null;
  }
}

/** Build shadow-DOM email preview content for a filed receipt note. */
export function resolveReceiptNoteEmailPreview(
  note: Pick<
    Note,
    | "title"
    | "content"
    | "rawHtml"
    | "tags"
    | "recordType"
    | "emailPipelineVersion"
    | "searchPlain"
  >,
): ReceiptEmailPreviewContent | null {
  const title = note.title?.trim() || "Receipt";
  const block = findEmailHtmlBlock(note.content ?? "");
  const blockHtml = block?.html?.trim() ?? "";
  const blockStyles = block?.styles ?? "";

  if (blockHtml) {
    const { html, extraCss } = displayStoredEmailHtml(
      blockHtml,
      blockStyles,
      block?.pipelineVersion ?? note.emailPipelineVersion ?? undefined,
    );
    const shadow = buildEmailShadowContent(html, extraCss);
    return { title, bodyHtml: shadow.bodyHtml, css: shadow.css };
  }

  const rawHtml = note.rawHtml?.trim();
  if (rawHtml) {
    const prepared = prepareInboundEmailHtml(rawHtml);
    if (prepared.html) {
      const { html, extraCss } = displayStoredEmailHtml(
        prepared.html,
        prepared.css,
        note.emailPipelineVersion ?? undefined,
      );
      const shadow = buildEmailShadowContent(html, extraCss);
      return { title, bodyHtml: shadow.bodyHtml, css: shadow.css };
    }
  }

  const plainTextFallback = extractPlainTextFallback(note);
  if (plainTextFallback) {
    return {
      title,
      bodyHtml: "",
      css: "",
      plainTextFallback,
    };
  }

  return null;
}

export function isPreviewableReceiptAttachment(mimeType: string, fileName: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  if (/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(fileName)) return true;
  return isPdfMimeType(mimeType, fileName);
}

export function attachmentToPreviewTarget(
  attachment: CachedNoteAttachment,
): FilePreviewTarget | null {
  if (!attachment.previewUrl) return null;
  return {
    url: attachment.previewUrl,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    attachmentId: attachment.id,
    noteId: attachment.noteId,
    pdfAnnotations: attachment.pdfAnnotations as PdfHighlightAnnotation[] | undefined,
  };
}

export async function loadReceiptPreviewTargets(noteId: string): Promise<FilePreviewTarget[]> {
  const attachments = await fetchNoteAttachments(noteId);
  return attachments
    .filter((attachment) =>
      isPreviewableReceiptAttachment(attachment.mimeType, attachment.fileName),
    )
    .map(attachmentToPreviewTarget)
    .filter((target): target is FilePreviewTarget => target != null);
}

export function buildReceiptPreviewCatalog(
  items: ReceiptLineItemRecord[],
): ReceiptPreviewCatalogEntry[] {
  const seen = new Set<string>();
  const catalog: ReceiptPreviewCatalogEntry[] = [];

  for (const item of items) {
    if (seen.has(item.noteId)) continue;
    seen.add(item.noteId);
    catalog.push({
      noteId: item.noteId,
      label: item.vendor?.trim() || item.itemName?.trim() || "Receipt",
    });
  }

  return catalog;
}

/** Preview slides for a single source file (images/PDFs attached to one note). */
export async function buildReceiptPreviewSlidesForNote(
  noteId: string,
  label: string,
): Promise<ReceiptPreviewSlide[]> {
  const targets = await loadReceiptPreviewTargets(noteId);
  return targets.map((target, imageIndex) => ({
    noteId,
    label,
    target,
    receiptIndex: 0,
    imageIndex,
    receiptImageCount: targets.length,
    receiptCount: 1,
  }));
}

export async function buildReceiptPreviewSlides(
  catalog: ReceiptPreviewCatalogEntry[],
): Promise<ReceiptPreviewSlide[]> {
  const galleries = await Promise.all(
    catalog.map(async (entry) => ({
      ...entry,
      targets: await loadReceiptPreviewTargets(entry.noteId),
    })),
  );

  const valid = galleries.filter((gallery) => gallery.targets.length > 0);
  const slides: ReceiptPreviewSlide[] = [];

  valid.forEach((gallery, receiptIndex) => {
    gallery.targets.forEach((target, imageIndex) => {
      slides.push({
        noteId: gallery.noteId,
        label: gallery.label,
        target,
        receiptIndex,
        imageIndex,
        receiptImageCount: gallery.targets.length,
        receiptCount: valid.length,
      });
    });
  });

  return slides;
}

export function findReceiptPreviewSlideIndex(
  slides: ReceiptPreviewSlide[],
  noteId: string,
): number {
  return slides.findIndex((slide) => slide.noteId === noteId);
}