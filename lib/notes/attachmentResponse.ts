/**
 * Safe response headers for note attachment downloads.
 * Untrusted MIME types must not be served inline on the app origin (stored XSS).
 */

const SAFE_INLINE_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const DANGEROUS_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "application/javascript",
  "text/javascript",
]);

export function normalizeMimeType(mimeType?: string | null): string {
  const raw = (mimeType || "application/octet-stream").split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
  return raw;
}

export function attachmentContentHeaders(mimeType: string | null | undefined, fileName: string): Record<string, string> {
  const mime = normalizeMimeType(mimeType);
  const safeName = fileName.replace(/[\r\n"]/g, "_").slice(0, 180) || "attachment";
  const inline = SAFE_INLINE_MIME.has(mime) && !DANGEROUS_MIME.has(mime);
  const contentType = inline ? mime : "application/octet-stream";

  return {
    "Content-Type": contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}

/** Reject path that does not stay under the attachment's workspace prefix. */
export function assertAttachmentStoragePath(
  storagePath: string,
  workspaceId: string,
): void {
  if (
    !storagePath ||
    storagePath.includes("..") ||
    !storagePath.startsWith(`${workspaceId}/`)
  ) {
    throw new Error("attachment_path_mismatch");
  }
}
