import type { FilePreviewTarget } from "@/components/FilePreviewModal";
import type { PdfHighlightAnnotation } from "@/lib/pdf/annotations";
import type { ReceiptLineItemRecord } from "@/lib/files/receiptLineItems";
import {
  fetchNoteAttachments,
  type CachedNoteAttachment,
} from "@/lib/notes/noteAttachmentListCache";
import { isPdfMimeType } from "@/lib/pdf/extractPdfText";

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