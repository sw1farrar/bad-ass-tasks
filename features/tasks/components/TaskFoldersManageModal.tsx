"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FolderPlus, Pencil, Trash2, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";

interface TaskFoldersManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: TaskFolder[];
  onAddFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
}

function ManageBody({
  folders,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onClose,
}: {
  folders: TaskFolder[];
  onAddFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TaskFolder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || isSaving) return;
    setIsSaving(true);
    try {
      await onAddFolder(name);
      setNewFolderName("");
    } finally {
      setIsSaving(false);
    }
  };

  const commitRename = async (folderId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await onRenameFolder(folderId, name);
      setEditingId(null);
      setEditingName("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="task-folders-manage__body space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Task folders
            </h3>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed">
              Group tasks by project or area. Deleting a folder unfiles its tasks.
            </p>
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

        <form
          className="flex gap-2"
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
          />
          <button
            type="submit"
            disabled={isSaving || !newFolderName.trim()}
            className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm shrink-0 disabled:opacity-50 min-h-[44px]"
          >
            <FolderPlus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="task-folders-manage__list space-y-1.5 max-h-[min(50vh,20rem)] overflow-y-auto">
          {folders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-glass px-4 py-6 text-center text-sm text-text-muted">
              No folders yet. Create one above.
            </p>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className="task-folders-manage__row flex items-center gap-2 rounded-xl border border-border-glass bg-surface-hover/60 px-3 py-2"
              >
                {editingId === folder.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRename(folder.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditingName("");
                      }
                    }}
                    className="input flex-1 px-2.5 py-2 text-sm min-h-[40px]"
                    autoFocus
                    aria-label={`Rename ${folder.name}`}
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">
                    {folder.name}
                  </span>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  {editingId === folder.id ? (
                    <button
                      type="button"
                      onClick={() => void commitRename(folder.id)}
                      disabled={isSaving || !editingName.trim()}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(folder.id);
                        setEditingName(folder.name);
                      }}
                      className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
                      aria-label={`Rename ${folder.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(folder)}
                    className="rounded-lg p-2 text-text-muted hover:text-[var(--priority-p0)] hover:bg-[var(--priority-p0)]/10 transition"
                    aria-label={`Delete ${folder.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmationModal
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete folder?"
        highlight={pendingDelete?.name}
        description="Tasks in this folder will move to Unfiled. The tasks themselves are not deleted."
        confirmText="Delete folder"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) void onDeleteFolder(pendingDelete.id);
        }}
      />
    </>
  );
}

export function TaskFoldersManageModal({
  open,
  onOpenChange,
  folders,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: TaskFoldersManageModalProps) {
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
    <ManageBody
      folders={folders}
      onAddFolder={onAddFolder}
      onRenameFolder={onRenameFolder}
      onDeleteFolder={onDeleteFolder}
      onClose={close}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={close}
        title="Task folders"
        zIndex={850}
        panelClassName="task-folders-manage-modal"
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        ariaLabel="Task folders"
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
        aria-label="Task folders"
        className={cn(
          "task-folders-manage-modal relative w-full md:max-w-lg bg-bg-panel border border-border-glass modal-panel shadow-2xl rounded-2xl",
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