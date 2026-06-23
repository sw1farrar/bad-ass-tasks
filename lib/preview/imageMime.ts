export function isImageMime(mime?: string, fileName?: string): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fileName ?? "");
}