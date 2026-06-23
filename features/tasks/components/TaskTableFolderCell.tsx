"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isClickInsideTaskTablePopover } from "@/lib/dom/taskTablePopoverDismiss";
import { useAnchoredPopoverPosition } from "@/lib/hooks/useAnchoredPopoverPosition";
import { useTaskStore } from "@/store/useTaskStore";
import type { TaskFolder } from "@/types";

interface TaskTableFolderCellProps {
  folders: TaskFolder[];
  folderId?: string | null;
  disabled?: boolean;
  onChange: (folderId: string | null) => void;
}

export function TaskTableFolderCell({
  folders,
  folderId,
  disabled = false,
  onChange,
}: TaskTableFolderCellProps) {
  const addTaskFolder = useTaskStore((s) => s.addTaskFolder);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const folderName = folders.find((f) => f.id === folderId)?.name;
  const createSectionHeight = 76;
  const popoverPosition = useAnchoredPopoverPosition({
    open,
    anchorRef: triggerRef,
    panelRef,
    estimatedWidth: 240,
    estimatedHeight: Math.min(360, 44 + folders.length * 40 + 16 + createSectionHeight),
    horizontalAlign: "auto",
    boundaryMode: "viewport",
    sizeMode: "content",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setNewFolderName("");
      setIsSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (isClickInsideTaskTablePopover(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [open]);

  const selectFolder = (nextId: string | null) => {
    onChange(nextId);
    setOpen(false);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || isSaving || disabled) return;
    setIsSaving(true);
    try {
      const created = await addTaskFolder(name);
      setNewFolderName("");
      onChange(created.id);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const popover =
    open && mounted && popoverPosition ? (
      <div
        ref={panelRef}
        role="listbox"
        aria-label="Task folder"
        className="tasks-folder-popover tasks-table-popover tasks-anchor-popover fixed w-[min(240px,calc(100vw-16px))] rounded-xl border border-border-glass bg-bg-panel shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        data-popover-placement={popoverPosition.placement}
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border-glass text-[10px] font-semibold uppercase tracking-wide text-text-muted shrink-0">
          Folder
        </div>
        <div className="p-1.5 flex flex-col gap-0.5">
          <button
            type="button"
            role="option"
            aria-selected={!folderId}
            onClick={() => selectFolder(null)}
            disabled={isSaving}
            className={cn(
              "tasks-folder-popover__option flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
              !folderId
                ? "bg-neon-purple/15 text-neon-purple"
                : "text-text-primary hover:bg-surface-hover",
            )}
          >
            <Folder className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="flex-1 min-w-0">No folder</span>
            {!folderId ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
          </button>
          {folders.map((folder) => {
            const active = folderId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={isSaving}
                onClick={() => selectFolder(folder.id)}
                className={cn(
                  "tasks-folder-popover__option flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                  active
                    ? "bg-neon-purple/15 text-neon-purple"
                    : "text-text-primary hover:bg-surface-hover",
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0 truncate">{folder.name}</span>
                {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
          {folders.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted text-center">
              No folders yet — create one below.
            </p>
          ) : null}
        </div>
        <form
          className="tasks-folder-popover__create border-t border-border-glass p-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateFolder();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Create new folder
          </p>
          <div className="flex gap-1.5">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="input flex-1 min-w-0 px-2.5 py-1.5 text-sm"
              aria-label="New folder name"
              disabled={isSaving || disabled}
            />
            <button
              type="submit"
              disabled={isSaving || disabled || !newFolderName.trim()}
              className="btn btn-primary inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden />
              Create
            </button>
          </div>
        </form>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={cn(
          "tasks-folder-inline-trigger inline-flex w-full max-w-full min-h-[28px] items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
          folderName
            ? "tasks-table-folder border-border-glass bg-surface-inset text-text-secondary hover:border-neon-purple/35 hover:bg-surface-hover"
            : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-secondary",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={folderName ? `Folder: ${folderName}. Click to change.` : "Set folder"}
      >
        {folderName ? (
          <>
            <FolderOpen className="h-3 w-3 shrink-0 text-neon-purple/80" aria-hidden />
            <span className="truncate">{folderName}</span>
          </>
        ) : (
          <>
            <Folder className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span>—</span>
          </>
        )}
      </button>
      {popover && typeof document !== "undefined"
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
