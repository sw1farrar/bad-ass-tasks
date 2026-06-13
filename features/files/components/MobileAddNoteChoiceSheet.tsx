"use client";

import React from "react";
import { Camera, FileText } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";

interface MobileAddNoteChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  onUploadPhotos: () => void;
  onTextNote: () => void;
}

export function MobileAddNoteChoiceSheet({
  open,
  onClose,
  onUploadPhotos,
  onTextNote,
}: MobileAddNoteChoiceSheetProps) {
  const handlePhotos = () => {
    onClose();
    onUploadPhotos();
  };

  const handleText = () => {
    onClose();
    onTextNote();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add note"
      ariaLabel="Choose how to add a note"
      mobileLayout="centered"
      showDragHandle={false}
      desktopMaxWidth="max-w-sm"
    >
      <div className="flex flex-col gap-2 p-4 pt-3">
        <button
          type="button"
          onClick={handlePhotos}
          className={cn(
            "files-add-note-choice flex w-full items-center gap-3 rounded-2xl border border-border-glass",
            "bg-bg-secondary px-4 py-3.5 text-left min-h-[56px] transition",
            "hover:border-neon-purple/35 hover:bg-surface-hover active:scale-[0.99]",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neon-purple/25 bg-neon-purple/10 text-neon-purple">
            <Camera className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Upload photos</span>
            <span className="block text-xs text-text-muted mt-0.5">Capture or choose images for review</span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleText}
          className={cn(
            "files-add-note-choice flex w-full items-center gap-3 rounded-2xl border border-border-glass",
            "bg-bg-secondary px-4 py-3.5 text-left min-h-[56px] transition",
            "hover:border-neon-purple/35 hover:bg-surface-hover active:scale-[0.99]",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-glass bg-bg-panel text-text-secondary">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Text note</span>
            <span className="block text-xs text-text-muted mt-0.5">Write a note from scratch</span>
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}