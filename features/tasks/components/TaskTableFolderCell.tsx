"use client";

import { Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTableFolderCellProps {
  folderName?: string;
  disabled?: boolean;
  onOpen: () => void;
}

export function TaskTableFolderCell({
  folderName,
  disabled = false,
  onOpen,
}: TaskTableFolderCellProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "tasks-folder-inline-trigger inline-flex max-w-full min-h-[28px] items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 disabled:opacity-50 disabled:pointer-events-none",
        folderName
          ? "tasks-table-folder border-border-glass bg-surface-inset text-text-secondary hover:border-neon-purple/35 hover:bg-surface-hover"
          : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text-secondary",
      )}
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
  );
}