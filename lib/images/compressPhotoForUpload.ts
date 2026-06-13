const DEFAULT_MAX_LONG_EDGE = 1400;
const DEFAULT_JPEG_QUALITY = 0.86;
const DEFAULT_WEBP_QUALITY = 0.82;

export type CompressPhotoOptions = {
  maxLongEdge?: number;
  jpegQuality?: number;
  webpQuality?: number;
};

export function computeScaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width, height };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

let webpSupport: boolean | null = null;

async function supportsWebpEncoding(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport;
  if (typeof document === "undefined") {
    webpSupport = false;
    return false;
  }

  webpSupport = await new Promise<boolean>((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => resolve(blob?.type === "image/webp"), "image/webp", 0.8);
  });

  return webpSupport;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function buildOutputName(file: File, mimeType: string): string {
  const base = file.name.replace(/\.[^/.]+$/, "") || "photo";
  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  return `${base}.${ext}`;
}

/** Scale and compress a photo for efficient note attachment upload. */
export async function compressPhotoForUpload(
  file: File,
  options: CompressPhotoOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxLongEdge = options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const useWebp = await supportsWebpEncoding();
  const mimeType = useWebp ? "image/webp" : "image/jpeg";
  const quality = useWebp
    ? (options.webpQuality ?? DEFAULT_WEBP_QUALITY)
    : (options.jpegQuality ?? DEFAULT_JPEG_QUALITY);

  const image = await loadImageFromFile(file);
  const { width, height } = computeScaledDimensions(image.naturalWidth, image.naturalHeight, maxLongEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) return file;

  if (blob.size >= file.size && file.size > 0 && width === image.naturalWidth) {
    return file;
  }

  return new File([blob], buildOutputName(file, mimeType), {
    type: mimeType,
    lastModified: Date.now(),
  });
}

export async function compressPhotosForUpload(
  files: File[],
  options?: CompressPhotoOptions,
): Promise<File[]> {
  const results: File[] = [];
  for (const file of files) {
    results.push(await compressPhotoForUpload(file, options));
  }
  return results;
}