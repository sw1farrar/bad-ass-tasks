"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Folder, FolderOpen, FolderPlus, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";

interface TaskFolderSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
  selectedFolderId?: string | null;
  folders: TaskFolder[];
  onSelectFolder: (folderId: string | null) => void | Promise<void>;
  onAddFolder: (name: string) => Promise<unknown>;
}

function SelectBody({
  taskTitle,
  selectedFolderId,
  folders,
  onSelectFolder,
  onAddFolder,
  onClose,
}: Omit<TaskFolderSelectModalProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [newFolderName, setNewFolderName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = async (folderId: string | null) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSelectFolder(folderId);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    try {
      const created = await onAddFolder(name);
      const folderId = (created as TaskFolder | null)?.id;
      if (folderId) {
        await onSelectFolder(folderId);
        setNewFolderName("");
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const optionClass = (active: boolean) =>
    cn(
      "task-folder-select__option flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition min-h-[44px]",
      active
        ? "border-neon-purple/45 bg-neon-purple/12 text-neon-purple"
        : "border-border-glass bg-surface-hover/50 text-text-primary hover:border-neon-purple/30 hover:bg-surface-hover",
    );

  return (
    <div className="task-folder-select__body space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text-primary tracking-tight">Choose folder</h3>
          {taskTitle ? (
            <p className="mt-1 text-sm text-text-secondary leading-relaxed truncate" title={taskTitle}>
              {taskTitle}
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary leading-relaxed">
              File this task or create a new folder.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover transition shrink-0"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="task-folder-select__list space-y-1.5 max-h-[min(40vh,16rem)] overflow-y-auto">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSelect(null)}
          className={optionClass(!selectedFolderId)}
        >
          <Folder className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <span className="flex-1 min-w-0">Unfiled</span>
          {!selectedFolderId ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
        </button>

        {folders.map((folder) => {
          const active = selectedFolderId === folder.id;
          return (
            <button
              key={folder.id}
              type="button"
              disabled={isSaving}
              onClick={() => void handleSelect(folder.id)}
              className={optionClass(active)}
            >
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 truncate">{folder.name}</span>
              {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}

        {folders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-glass px-4 py-4 text-center text-sm text-text-muted">
            No folders yet. Create one below.
          </p>
        ) : null}
      </div>

      <form
        className="task-folder-select__create flex gap-2 border-t border-border-glass pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreateFolder();
        }}
      >
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New folder name"
          className="input flex-1 px-3 py-2.5 text-sm min-h-[44px]"
          aria-label="New folder name"
          disabled={isSaving}
        />
        <button
          type="submit"
          disabled={isSaving || !newFolderName.trim()}
          className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm shrink-0 disabled:opacity-50 min-h-[44px]"
        >
          <FolderPlus className="h-4 w-4" />
          Create
        </button>
      </form>
    </div>
  );
}

export function TaskFolderSelectModal({
  open,
  onOpenChange,
  taskTitle,
  selectedFolderId,
  folders,
  onSelectFolder,
  onAddFolder,
}: TaskFolderSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useScrollLock(open && !isMobile);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, isMobile]);

  if (!open || !mounted) return null;

  const body = (
    <SelectBody
      taskTitle={taskTitle}
      selectedFolderId={selectedFolderId}
      folders={folders}
      onSelectFolder={onSelectFolder}
      onAddFolder={onAddFolder}
      onClose={close}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title="Choose folder"
        zIndex={850}
        panelClassName="task-folder-select-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        ariaLabel="Choose folder"
      >
        {body}
      </BottomSheet>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[850] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose folder"
        className={cn(
          "task-folder-select-modal relative w-full md:max-w-md bg-bg-panel border border-border-glass modal-panel shadow-2xl rounded-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}