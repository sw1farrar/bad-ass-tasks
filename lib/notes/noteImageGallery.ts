import type { ImagePreviewItem } from "@/features/notes/editor/components/ImagePreviewModal";
import { isImageMime } from "@/lib/preview/imageMime";
import type { CachedNoteAttachment } from "@/lib/notes/noteAttachmentListCache";

export function attachmentIsGalleryImage(mimeType: string, fileName: string): boolean {
  return isImageMime(mimeType, fileName);
}

export function attachmentsToImagePreviewItems(
  attachments: CachedNoteAttachment[],
): ImagePreviewItem[] {
  return attachments
    .filter(
      (attachment) =>
        attachment.previewUrl &&
        attachmentIsGalleryImage(attachment.mimeType, attachment.fileName),
    )
    .map((attachment) => ({
      src: attachment.previewUrl!,
      alt: attachment.fileName,
      mimeType: attachment.mimeType,
    }));
}

export function findImagePreviewIndexFromAttachments(
  attachments: CachedNoteAttachment[],
  attachmentId?: string,
  url?: string,
): number {
  const imageAttachments = attachments.filter(
    (attachment) =>
      attachment.previewUrl &&
      attachmentIsGalleryImage(attachment.mimeType, attachment.fileName),
  );
  if (attachmentId) {
    const byId = imageAttachments.findIndex((attachment) => attachment.id === attachmentId);
    if (byId >= 0) return byId;
  }
  if (url) {
    const byUrl = imageAttachments.findIndex((attachment) => attachment.previewUrl === url);
    if (byUrl >= 0) return byUrl;
  }
  return 0;
}