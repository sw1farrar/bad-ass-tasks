"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ImagePreviewModal } from "@/features/notes/editor/components/ImagePreviewModal";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchNoteAttachments,
  getCachedNoteAttachments,
} from "@/lib/notes/noteAttachmentListCache";
import { formatBytes } from "@/lib/files/formatBytes";
import { AttachmentImageSizeBadge } from "@/features/notes/components/AttachmentImageSizeBadge";
import { cn } from "@/lib/utils";

type GalleryImage = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function isImageAttachment(mimeType: string, fileName: string): boolean {
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(fileName);
}

interface NoteMobileImageGalleryProps {
  noteId: string;
  countHint?: number;
  countsReady?: boolean;
  className?: string;
}

export function NoteMobileImageGallery({
  noteId,
  countHint = 0,
  countsReady = false,
  className,
}: NoteMobileImageGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setImages([]);
      return;
    }

    if (countsReady && countHint === 0) {
      setImages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = getCachedNoteAttachments(noteId);
    if (cached) {
      const cachedImages = cached
        .filter((item) => isImageAttachment(item.mimeType, item.fileName) && item.previewUrl)
        .map((item) => ({
          id: item.id,
          url: item.previewUrl!,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
        }));
      setImages(cachedImages);
      setLoading(false);
    } else {
      setLoading(true);
    }

    void (async () => {
      try {
        const list = await fetchNoteAttachments(noteId);
        if (cancelled) return;
        const nextImages = list
          .filter((item) => isImageAttachment(item.mimeType, item.fileName) && item.previewUrl)
          .map((item) => ({
            id: item.id,
            url: item.previewUrl!,
            fileName: item.fileName,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
          }));
        setImages(nextImages);
      } catch {
        if (!cancelled && !cached) setImages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [noteId, countHint, countsReady]);

  const hasImages = images.length > 0;
  const showSkeleton = loading && (countHint > 0 || !countsReady);

  const skeletonCount = useMemo(
    () => Math.min(Math.max(countHint || 1, 1), 4),
    [countHint],
  );

  if (!isSupabaseConfigured()) return null;
  if (!showSkeleton && !hasImages) return null;

  return (
    <>
      <section
        className={cn("note-mobile-image-gallery", className)}
        aria-label="Photo gallery"
      >
        <div className="note-mobile-image-gallery__header">
          <span className="note-mobile-image-gallery__label">Photos</span>
          {hasImages && (
            <span className="note-mobile-image-gallery__count">{images.length}</span>
          )}
          {showSkeleton && <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-purple" aria-hidden />}
        </div>

        <div className="note-mobile-image-gallery__strip">
          {showSkeleton
            ? Array.from({ length: skeletonCount }).map((_, index) => (
                <div key={index} className="note-mobile-image-gallery__skeleton" aria-hidden />
              ))
            : images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setPreviewIndex(index)}
                  className="note-mobile-image-gallery__thumb relative"
                  style={{ animationDelay: `${index * 40}ms` }}
                  aria-label={`Open ${image.fileName}${
                    image.sizeBytes > 0 ? `, ${formatBytes(image.sizeBytes)}` : ""
                  }`}
                >
                  <img src={image.url} alt="" loading="lazy" decoding="async" />
                  <AttachmentImageSizeBadge sizeBytes={image.sizeBytes} />
                </button>
              ))}
        </div>
      </section>

      {previewIndex !== null && images.length > 0 ? (
        <ImagePreviewModal
          onClose={() => setPreviewIndex(null)}
          gallery={{
            items: images.map((image) => ({
              src: image.url,
              alt: image.fileName,
              mimeType: image.mimeType,
            })),
            index: previewIndex,
            onIndexChange: setPreviewIndex,
            loop: true,
          }}
        />
      ) : null}
    </>
  );
}