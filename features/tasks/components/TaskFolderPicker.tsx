"use client";

import { Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFolder } from "@/types";

interface TaskFolderPickerProps {
  folders: TaskFolder[];
  value: string | null | undefined;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  onChange: (folderId: string | null) => void;
}

export function TaskFolderPicker({
  folders,
  value,
  disabled = false,
  compact = false,
  className,
  onChange,
}: TaskFolderPickerProps) {
  const activeFolder = folders.find((f) => f.id === value);

  return (
    <div
      className={cn("task-folder-picker relative inline-flex min-w-0", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <label className="sr-only" htmlFor={`task-folder-${value ?? "none"}`}>
        Task folder
      </label>
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted">
        {activeFolder ? (
          <FolderOpen className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
        ) : (
          <Folder className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
        )}
      </div>
      <select
        id={`task-folder-${value ?? "none"}`}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "task-folder-picker__select w-full appearance-none rounded-lg border border-border-glass bg-surface-inset text-left text-xs font-medium text-text-primary transition hover:border-neon-purple/40 focus:border-neon-purple focus:outline-none focus:ring-2 focus:ring-neon-purple/20 disabled:opacity-50",
          compact ? "h-8 pl-7 pr-7 py-1" : "h-9 pl-8 pr-8 py-1.5",
        )}
      >
        <option value="">No folder</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>
    </div>
  );
}