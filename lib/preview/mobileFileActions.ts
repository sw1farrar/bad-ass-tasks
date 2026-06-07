export type PreviewFileRef = {
  url: string;
  fileName: string;
  mimeType?: string;
};

export function isImagePreviewFile(mimeType?: string, fileName?: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(fileName ?? "");
}

export function toAbsolutePreviewUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function canSharePreviewFiles(files: File[]): boolean {
  if (!canNativeShare() || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

function guessMimeType(fileName: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  return "application/octet-stream";
}

export async function fetchPreviewFileBlob(ref: PreviewFileRef): Promise<Blob> {
  const isLocalUrl = ref.url.startsWith("data:") || ref.url.startsWith("blob:");
  const response = await fetch(ref.url, isLocalUrl ? undefined : { credentials: "include" });
  if (!response.ok) throw new Error("fetch_failed");
  return response.blob();
}

export async function fetchPreviewFile(ref: PreviewFileRef): Promise<File> {
  const blob = await fetchPreviewFileBlob(ref);
  const type = guessMimeType(ref.fileName, ref.mimeType || blob.type);
  return new File([blob], ref.fileName, { type });
}

export async function sharePreviewFile(ref: PreviewFileRef): Promise<"shared" | "cancelled" | "unavailable"> {
  if (!canNativeShare()) return "unavailable";

  try {
    const file = await fetchPreviewFile(ref);
    const payload: ShareData = {
      title: ref.fileName,
      text: ref.fileName,
    };

    if (canSharePreviewFiles([file])) {
      await navigator.share({ ...payload, files: [file] });
      return "shared";
    }

    await navigator.share({
      ...payload,
      url: toAbsolutePreviewUrl(ref.url),
    });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "unavailable";
  }
}

/** Opens the native share sheet — on iOS this includes "Save Image" for photos. */
export async function saveImageToPhotos(ref: PreviewFileRef): Promise<"saved" | "cancelled" | "fallback"> {
  try {
    const file = await fetchPreviewFile(ref);
    if (canSharePreviewFiles([file])) {
      await navigator.share({ files: [file], title: ref.fileName });
      return "saved";
    }
    return "fallback";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "fallback";
  }
}

export async function savePreviewToFiles(ref: PreviewFileRef): Promise<"saved" | "cancelled" | "fallback"> {
  try {
    const file = await fetchPreviewFile(ref);
    if (canSharePreviewFiles([file])) {
      await navigator.share({ files: [file], title: ref.fileName });
      return "saved";
    }
    return "fallback";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "fallback";
  }
}

export function downloadPreviewFile(ref: PreviewFileRef, blob?: Blob): void {
  const url = blob ? URL.createObjectURL(blob) : ref.url;
  const link = document.createElement("a");
  link.href = url;
  link.download = ref.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (blob) {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function buildEmailShareUrl(ref: PreviewFileRef): string {
  const subject = encodeURIComponent(ref.fileName);
  const body = encodeURIComponent(
    `Attachment: ${ref.fileName}\n\n${toAbsolutePreviewUrl(ref.url)}`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export function buildTextShareUrl(ref: PreviewFileRef): string {
  const body = encodeURIComponent(`${ref.fileName}: ${toAbsolutePreviewUrl(ref.url)}`);
  return `sms:?&body=${body}`;
}

export async function copyPreviewLink(ref: PreviewFileRef): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(toAbsolutePreviewUrl(ref.url));
    return true;
  } catch {
    return false;
  }
}