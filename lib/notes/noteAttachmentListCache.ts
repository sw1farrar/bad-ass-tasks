export type CachedNoteAttachment = {
  id: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: "email" | "upload";
  createdAt: string;
  previewUrl: string | null;
  pdfAnnotations?: unknown;
};

type CacheEntry = {
  attachments?: CachedNoteAttachment[];
  promise?: Promise<CachedNoteAttachment[]>;
};

const cache = new Map<string, CacheEntry>();

export function getCachedNoteAttachments(noteId: string): CachedNoteAttachment[] | null {
  const entry = cache.get(noteId);
  return entry?.attachments?.length ? entry.attachments : null;
}

export function setCachedNoteAttachments(noteId: string, attachments: CachedNoteAttachment[]) {
  cache.set(noteId, { attachments });
}

export function invalidateNoteAttachments(noteId: string) {
  cache.delete(noteId);
}

function preloadImageUrls(attachments: CachedNoteAttachment[]) {
  if (typeof window === "undefined") return;
  for (const att of attachments) {
    if (!att.previewUrl) continue;
    if (!att.mimeType.startsWith("image/") && !/\.(png|jpe?g|gif|webp|bmp)$/i.test(att.fileName)) {
      continue;
    }
    const img = new window.Image();
    img.decoding = "async";
    img.src = att.previewUrl;
  }
}

export async function fetchNoteAttachments(noteId: string): Promise<CachedNoteAttachment[]> {
  const entry = cache.get(noteId);
  if (entry?.attachments) {
    preloadImageUrls(entry.attachments);
    return entry.attachments;
  }
  if (entry?.promise) return entry.promise;

  const promise = (async () => {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/attachments`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "attachment_list_failed");
    const list = (data.attachments ?? []) as CachedNoteAttachment[];
    cache.set(noteId, { attachments: list });
    preloadImageUrls(list);
    return list;
  })();

  cache.set(noteId, { ...entry, promise });

  try {
    return await promise;
  } catch (err) {
    cache.delete(noteId);
    throw err;
  } finally {
    const current = cache.get(noteId);
    if (current?.promise) {
      const { attachments } = current;
      cache.set(noteId, attachments ? { attachments } : {});
    }
  }
}

/** Fire-and-forget warm cache when a file with attachments is selected or hovered. */
export function prefetchNoteAttachments(noteId: string) {
  if (!noteId) return;
  const entry = cache.get(noteId);
  if (entry?.attachments || entry?.promise) return;
  void fetchNoteAttachments(noteId).catch(() => {
    /* preview warm-up — ignore */
  });
}