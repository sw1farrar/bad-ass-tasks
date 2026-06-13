/** Extract image files from a ClipboardEvent (screenshots often use items, not files). */
export function getClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];

  const fromItems: File[] = [];
  for (const item of Array.from(clipboardData.items || [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  if (fromItems.length > 0) return fromItems;

  return Array.from(clipboardData.files || []).filter((f) => f.type.startsWith("image/"));
}

export function getDroppedImageFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer?.files?.length) return [];
  return Array.from(dataTransfer.files).filter((f) => f.type.startsWith("image/"));
}

/** All files from clipboard (images, PDFs, docs, etc.). */
export function getClipboardFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];

  const fromItems: File[] = [];
  for (const item of Array.from(clipboardData.items || [])) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  if (fromItems.length > 0) return fromItems;

  return Array.from(clipboardData.files || []);
}

/** All files from a drag-and-drop event. */
export function getDroppedFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer?.files?.length) return [];
  return Array.from(dataTransfer.files);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}