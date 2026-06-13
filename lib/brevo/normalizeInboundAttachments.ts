import type { BrevoInboundAttachment, BrevoInboundEmailItem } from "./inboundTypes";

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Normalize Brevo attachment objects (PascalCase or occasional lowercase keys). */
export function normalizeInboundAttachment(raw: unknown): BrevoInboundAttachment | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const name =
    readString(record.Name) ??
    readString(record.name) ??
    readString(record.FileName) ??
    readString(record.fileName);
  const downloadToken =
    readString(record.DownloadToken) ??
    readString(record.downloadToken) ??
    readString(record.Token) ??
    readString(record.token);

  if (!name || !downloadToken) return null;

  const contentType =
    readString(record.ContentType) ??
    readString(record.contentType) ??
    readString(record.MimeType) ??
    readString(record.mimeType);
  const contentId =
    readString(record.ContentID) ??
    readString(record.ContentId) ??
    readString(record.contentId) ??
    readString(record.contentID);

  const contentLengthRaw = record.ContentLength ?? record.contentLength ?? record.Size ?? record.size;
  const contentLength =
    typeof contentLengthRaw === "number" && Number.isFinite(contentLengthRaw)
      ? contentLengthRaw
      : undefined;

  return {
    Name: name,
    DownloadToken: downloadToken,
    ContentType: contentType,
    ContentID: contentId,
    ContentLength: contentLength,
  };
}

export function listInboundAttachments(item: BrevoInboundEmailItem): BrevoInboundAttachment[] {
  const raw = item.Attachments;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const normalized: BrevoInboundAttachment[] = [];
  for (const entry of raw) {
    const att = normalizeInboundAttachment(entry);
    if (att) normalized.push(att);
  }
  return normalized;
}