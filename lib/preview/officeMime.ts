/** Normalize MIME — filename extension wins over generic/wrong storage types. */
export function resolvePreviewMimeType(mimeType?: string, fileName?: string): string | undefined {
  const lower = (fileName ?? "").trim().toLowerCase();

  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".docm")) {
    return "application/vnd.ms-word.document.macroEnabled.12";
  }
  if (/\.doc$/i.test(lower) && !/\.docx$/i.test(lower) && !/\.docm$/i.test(lower)) {
    return "application/msword";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (/\.xls$/i.test(lower) && !/\.xlsx$/i.test(lower)) {
    return "application/vnd.ms-excel";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  const mime = mimeType?.trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    return mimeType?.trim();
  }

  return mime.split(";")[0]?.trim() || mimeType?.trim();
}

export function isLegacyWordDoc(mimeType?: string, fileName?: string): boolean {
  const lower = (fileName ?? "").trim().toLowerCase();
  if (/\.(docx|docm)$/i.test(lower)) return false;
  // Extension wins; MIME alone is unreliable (many .docx uploads are stored as application/msword).
  return /\.doc$/i.test(lower) && !/\.docx$/i.test(lower) && !/\.docm$/i.test(lower);
}

/** Word files we can render in-browser with docx-preview (.docx / .docm). */
export function isDocxPreviewable(mimeType?: string, fileName?: string): boolean {
  if (isLegacyWordDoc(mimeType, fileName)) return false;

  const mime = resolvePreviewMimeType(mimeType, fileName)?.toLowerCase() ?? "";
  if (mime.includes("wordprocessingml")) return true;
  if (mime.includes("ms-word.document")) return true;

  const lower = (fileName ?? "").trim().toLowerCase();
  return /\.(docx|docm)$/i.test(lower);
}

export function isWordFile(mimeType?: string, fileName?: string): boolean {
  if (isLegacyWordDoc(mimeType, fileName) || isDocxPreviewable(mimeType, fileName)) {
    return true;
  }
  const mime = resolvePreviewMimeType(mimeType, fileName)?.toLowerCase() ?? "";
  return mime === "application/msword";
}

export function isXlsxPreviewable(mimeType?: string, fileName?: string): boolean {
  const mime = resolvePreviewMimeType(mimeType, fileName)?.toLowerCase() ?? "";
  if (mime.includes("spreadsheetml")) return true;
  if (mime.includes("spreadsheet")) return true;
  if (mime === "application/vnd.ms-excel") return true;

  const lower = (fileName ?? "").trim().toLowerCase();
  return /\.xlsx?$/i.test(lower);
}