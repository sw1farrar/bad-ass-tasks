const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;

export function isImageMimeType(mimeType: string | undefined | null, fileName?: string): boolean {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) return true;
  if (fileName && IMAGE_EXT_RE.test(fileName.trim())) return true;
  return false;
}