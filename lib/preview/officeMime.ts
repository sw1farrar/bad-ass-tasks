/** Normalize MIME when storage only has application/octet-stream. */
export function resolvePreviewMimeType(mimeType?: string, fileName?: string): string | undefined {
  const mime = mimeType?.trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") return mimeType?.trim();

  const lower = (fileName ?? "").trim().toLowerCase();
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".docm")) {
    return "application/vnd.ms-word.document.macroEnabled.12";
  }
  if (lower.endsWith(".doc")) {
    return "application/msword";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  return mimeType?.trim();
}

export function isLegacyWordDoc(mimeType?: string, fileName?: string): boolean {
  const mime = resolvePreviewMimeType(mimeType, fileName)?.toLowerCase();
  if (mime === "application/msword") return true;
  const lower = (fileName ?? "").trim().toLowerCase();
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
  return isLegacyWordDoc(mimeType, fileName) || isDocxPreviewable(mimeType, fileName);
}

export function isXlsxPreviewable(mimeType?: string, fileName?: string): boolean {
  const mime = resolvePreviewMimeType(mimeType, fileName)?.toLowerCase() ?? "";
  if (mime.includes("spreadsheetml")) return true;
  if (mime.includes("spreadsheet")) return true;
  if (mime === "application/vnd.ms-excel") return true;

  const lower = (fileName ?? "").trim().toLowerCase();
  return /\.xlsx?$/i.test(lower);
}