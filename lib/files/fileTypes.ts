export type FileReviewStatus = "pending_review" | "filed";

export type FileRecordType = "note" | "email" | "document" | "receipt" | "other";

export const FILE_REVIEW_PENDING: FileReviewStatus = "pending_review";
export const FILE_REVIEW_FILED: FileReviewStatus = "filed";

export const FILE_RECORD_TYPES: FileRecordType[] = [
  "note",
  "email",
  "document",
  "receipt",
  "other",
];

export function inferRecordTypeFromTags(tags: string[]): FileRecordType {
  if (tags.includes("from-email")) return "email";
  return "note";
}

/** Classify uploaded attachments for Review intake. */
export function inferRecordTypeFromMime(mimeType: string): FileRecordType {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("receipt") || mime === "application/vnd.sealedmedia.softseal.pdf") {
    return "receipt";
  }
  if (
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime.startsWith("application/vnd.") ||
    mime.startsWith("text/") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  ) {
    return "document";
  }
  return "document";
}

export function recordTypeLabel(type: FileRecordType): string {
  switch (type) {
    case "email":
      return "Email";
    case "document":
      return "Document";
    case "receipt":
      return "Receipt";
    case "other":
      return "Other";
    default:
      return "Note";
  }
}