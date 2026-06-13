"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { MobileDrawerShell } from "@/components/MobileDrawerShell";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { compressPhotoForUpload } from "@/lib/images/compressPhotoForUpload";
import { cn, triggerHaptic } from "@/lib/utils";

export type CapturedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type MobilePhotoCaptureFlowProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (files: File[]) => Promise<void>;
};

function createPhotoId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToCapturedPhoto(file: File): Promise<CapturedPhoto> {
  const compressed = await compressPhotoForUpload(file);
  return {
    id: createPhotoId(),
    file: compressed,
    previewUrl: URL.createObjectURL(compressed),
  };
}

export function MobilePhotoCaptureFlow({
  open,
  onClose,
  onComplete,
}: MobilePhotoCaptureFlowProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<CapturedPhoto[]>([]);

  useScrollLock(open);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!open) return;
    setPhotos([]);
    setProcessing(false);
    setSubmitting(false);
    setProgressLabel(null);
  }, [open]);

  useEffect(
    () => () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    },
    [],
  );

  const revokePhoto = useCallback((photo: CapturedPhoto) => {
    URL.revokeObjectURL(photo.previewUrl);
  }, []);

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length || processing || submitting) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast.error("Choose an image file");
      return;
    }

    setProcessing(true);
    try {
      const next: CapturedPhoto[] = [];
      for (let index = 0; index < imageFiles.length; index += 1) {
        setProgressLabel(`Optimizing ${index + 1} of ${imageFiles.length}…`);
        next.push(await fileToCapturedPhoto(imageFiles[index]));
      }
      setPhotos((current) => [...current, ...next]);
      triggerHaptic("light");
    } catch {
      toast.error("Could not process photo");
    } finally {
      setProcessing(false);
      setProgressLabel(null);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
    }
  }, [processing, submitting]);

  const removePhoto = useCallback(
    (id: string) => {
      setPhotos((current) => {
        const target = current.find((photo) => photo.id === id);
        if (target) revokePhoto(target);
        return current.filter((photo) => photo.id !== id);
      });
      triggerHaptic("light");
    },
    [revokePhoto],
  );

  const handleCreateNote = useCallback(async () => {
    if (!photos.length || submitting || processing) return;

    setSubmitting(true);
    setProgressLabel("Creating note…");
    try {
      await onComplete(photos.map((photo) => photo.file));
      for (const photo of photos) revokePhoto(photo);
      setPhotos([]);
      onClose();
    } catch {
      toast.error("Could not create note");
    } finally {
      setSubmitting(false);
      setProgressLabel(null);
    }
  }, [photos, submitting, processing, onComplete, onClose, revokePhoto]);

  const busy = processing || submitting;

  return (
    <MobileDrawerShell
      open={open}
      onClose={busy ? () => {} : onClose}
      isMobile
      zIndex={320}
      panelClassName="mobile-photo-capture-sheet h-[100dvh] max-h-[100dvh] rounded-none border-0"
      ariaLabel="Capture photos for a new note"
    >
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void addFiles(event.target.files)}
      />

      <div className="mobile-photo-capture flex flex-col min-h-0 flex-1">
        <header className="mobile-photo-capture__header shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border-glass">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-purple-tint">
              New photo note
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              {photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "Capture photos"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mobile-photo-capture__icon-btn"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mobile-photo-capture__body flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
          {photos.length === 0 ? (
            <div className="mobile-photo-capture__empty space-y-4">
              <div className="mobile-photo-capture__hero rounded-3xl border border-neon-purple/25 bg-gradient-to-br from-neon-purple/14 via-bg-secondary to-bg-panel px-5 py-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-purple/15 text-neon-purple">
                  <Camera className="h-8 w-8" />
                </div>
                <p className="text-center text-sm text-text-secondary">
                  Snap or pick photos, keep adding in one session, then create a note with everything attached.
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => cameraInputRef.current?.click()}
                className="mobile-photo-capture__primary-btn"
              >
                <Camera className="h-5 w-5" />
                Take photo
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => libraryInputRef.current?.click()}
                className="mobile-photo-capture__secondary-btn"
              >
                <ImagePlus className="h-5 w-5" />
                Choose from library
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mobile-photo-capture__grid">
                <AnimatePresence initial={false}>
                  {photos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      layout
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="mobile-photo-capture__thumb"
                    >
                      <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removePhoto(photo.id)}
                        className="mobile-photo-capture__remove-btn"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cameraInputRef.current?.click()}
                  className="mobile-photo-capture__add-btn"
                >
                  <Camera className="h-4 w-4" />
                  Add photo
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => libraryInputRef.current?.click()}
                  className="mobile-photo-capture__add-btn"
                >
                  <Plus className="h-4 w-4" />
                  From library
                </button>
              </div>
            </div>
          )}

          {(processing || progressLabel) && (
            <div className="mobile-photo-capture__progress mt-4" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-neon-purple" />
              <span>{progressLabel ?? "Working…"}</span>
            </div>
          )}
        </div>

        <footer className="mobile-photo-capture__footer shrink-0 border-t border-border-glass px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={!photos.length || busy}
            onClick={() => void handleCreateNote()}
            className="mobile-photo-capture__done-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating note…
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                {photos.length > 0 ? `Create note (${photos.length})` : "Create note"}
              </>
            )}
          </button>
        </footer>
      </div>
    </MobileDrawerShell>
  );
}