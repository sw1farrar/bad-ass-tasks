"use client";

import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share2, X, Image as ImageIcon, FolderDown, Mail, MessageSquare, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  type PreviewFileRef,
  isImagePreviewFile,
  sharePreviewFile,
  saveImageToPhotos,
  savePreviewToFiles,
  downloadPreviewFile,
  fetchPreviewFile,
  buildEmailShareUrl,
  buildTextShareUrl,
  copyPreviewLink,
  canNativeShare,
} from "@/lib/preview/mobileFileActions";
import { cn, triggerHaptic } from "@/lib/utils";

const SHEET_SPRING = { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.85 };

type SheetMode = "save" | "share-fallback" | null;

interface PreviewMobileActionsProps {
  file: PreviewFileRef;
  className?: string;
}

function ActionSheetRow({
  icon,
  label,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-white/8 disabled:opacity-50 touch-manipulation"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/90">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? (
          <span className="block text-xs text-white/55">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

export function PreviewMobileActions({ file, className }: PreviewMobileActionsProps) {
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const isImage = isImagePreviewFile(file.mimeType, file.fileName);

  const closeSheet = useCallback(() => setSheet(null), []);

  const runShare = useCallback(async () => {
    setBusy("share");
    triggerHaptic("light");
    try {
      const result = await sharePreviewFile(file);
      if (result === "shared") return;
      if (result === "cancelled") return;
      setSheet("share-fallback");
    } catch {
      setSheet("share-fallback");
    } finally {
      setBusy(null);
    }
  }, [file]);

  const runSaveToPhotos = useCallback(async () => {
    setBusy("save");
    triggerHaptic("light");
    try {
      const result = await saveImageToPhotos(file);
      if (result === "saved") {
        closeSheet();
        return;
      }
      if (result === "cancelled") {
        closeSheet();
        return;
      }
      const blob = await fetchPreviewFile(file);
      downloadPreviewFile(file, blob);
      toast.success("Image downloaded");
      closeSheet();
    } catch {
      toast.error("Could not save image");
    } finally {
      setBusy(null);
    }
  }, [closeSheet, file]);

  const runSaveToFiles = useCallback(async () => {
    setBusy("save");
    triggerHaptic("light");
    try {
      const result = await savePreviewToFiles(file);
      if (result === "saved") {
        closeSheet();
        return;
      }
      if (result === "cancelled") {
        closeSheet();
        return;
      }
      const blob = await fetchPreviewFile(file);
      downloadPreviewFile(file, blob);
      toast.success("File downloaded");
      closeSheet();
    } catch {
      toast.error("Could not save file");
    } finally {
      setBusy(null);
    }
  }, [closeSheet, file]);

  const openSaveSheet = useCallback(() => {
    triggerHaptic("light");
    if (isImage) {
      setSheet("save");
      return;
    }
    void runSaveToFiles();
  }, [isImage, runSaveToFiles]);

  const chromeButtonClass =
    "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95 touch-manipulation disabled:opacity-60";

  const actionSheet = (
    <AnimatePresence>
      {sheet && (
        <motion.div
          key="preview-action-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10060] flex flex-col justify-end"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={closeSheet}
            aria-label="Dismiss"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SHEET_SPRING}
            className="relative z-10 mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-hidden rounded-2xl border border-white/10 bg-[#18181b]/95 shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "save" ? "Save options" : "Share options"}
          >
            <div className="px-2 py-2">
              {sheet === "save" && (
                <>
                  <ActionSheetRow
                    icon={<ImageIcon className="h-5 w-5" />}
                    label="Save to Photos"
                    description="Opens share sheet with Save Image"
                    onClick={() => void runSaveToPhotos()}
                    disabled={busy === "save"}
                  />
                  <ActionSheetRow
                    icon={<FolderDown className="h-5 w-5" />}
                    label="Save to Files"
                    description="Save to Files, iCloud, or Downloads"
                    onClick={() => void runSaveToFiles()}
                    disabled={busy === "save"}
                  />
                </>
              )}
              {sheet === "share-fallback" && (
                <>
                  <ActionSheetRow
                    icon={<Mail className="h-5 w-5" />}
                    label="Email"
                    description="Compose an email with a link"
                    onClick={() => {
                      window.location.href = buildEmailShareUrl(file);
                      closeSheet();
                    }}
                  />
                  <ActionSheetRow
                    icon={<MessageSquare className="h-5 w-5" />}
                    label="Text Message"
                    description="Send a text with a link"
                    onClick={() => {
                      window.location.href = buildTextShareUrl(file);
                      closeSheet();
                    }}
                  />
                  <ActionSheetRow
                    icon={<Link2 className="h-5 w-5" />}
                    label="Copy Link"
                    description="Copy attachment link to clipboard"
                    onClick={() => {
                      void copyPreviewLink(file).then((ok) => {
                        if (ok) toast.success("Link copied");
                        else toast.error("Could not copy link");
                        closeSheet();
                      });
                    }}
                  />
                </>
              )}
            </div>
            <div className="border-t border-white/10 px-3 py-2">
              <button
                type="button"
                onClick={closeSheet}
                className="w-full rounded-xl py-3 text-sm font-medium text-white/70 active:bg-white/8"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <button
          type="button"
          onClick={() => void runShare()}
          disabled={busy === "share"}
          className={chromeButtonClass}
          aria-label="Share attachment"
          title={canNativeShare() ? "Share" : "Share via email or text"}
        >
          {busy === "share" ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Share2 className="h-[18px] w-[18px]" />
          )}
        </button>
        <button
          type="button"
          onClick={openSaveSheet}
          disabled={busy === "save"}
          className={chromeButtonClass}
          aria-label={isImage ? "Save image" : "Save file"}
          title={isImage ? "Save to Photos or Files" : "Save to Files"}
        >
          {busy === "save" ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Download className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
      {typeof document !== "undefined" ? createPortal(actionSheet, document.body) : null}
    </>
  );
}