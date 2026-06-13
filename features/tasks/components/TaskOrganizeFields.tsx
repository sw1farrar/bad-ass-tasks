"use client";

import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import { TaskFolderPicker } from "./TaskFolderPicker";
import { TaskStarButton } from "./TaskStarButton";

interface TaskOrganizeFieldsProps {
  starred?: boolean;
  folderId?: string | null;
  disabled?: boolean;
  compact?: boolean;
  layout?: "stack" | "inline" | "modal-row";
  className?: string;
  onStarredChange: (starred: boolean) => void;
  onFolderChange: (folderId: string | null) => void;
}

export function TaskOrganizeFields({
  starred = false,
  folderId,
  disabled = false,
  compact = false,
  layout = "stack",
  className,
  onStarredChange,
  onFolderChange,
}: TaskOrganizeFieldsProps) {
  const getTaskFolders = useTaskStore((s) => s.getTaskFolders);
  const folders = getTaskFolders();

  if (layout === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <TaskStarButton
          size={compact ? "sm" : "md"}
          starred={starred}
          disabled={disabled}
          onToggle={() => onStarredChange(!starred)}
        />
        {folders.length > 0 ? (
          <TaskFolderPicker
            compact
            folders={folders}
            value={folderId}
            disabled={disabled}
            className="min-w-[8.5rem] max-w-[12rem]"
            onChange={onFolderChange}
          />
        ) : null}
      </div>
    );
  }

  if (layout === "modal-row") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border-glass bg-surface-hover/50 px-3 py-2.5 min-h-[44px]">
          <div className="min-w-0">
            <div className="text-xs font-medium text-text-secondary">Important</div>
          </div>
          <TaskStarButton
            starred={starred}
            disabled={disabled}
            onToggle={() => onStarredChange(!starred)}
          />
        </div>
        {folders.length > 0 ? (
          <label className="block space-y-1.5 min-w-0">
            <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              Folder
            </span>
            <TaskFolderPicker
              folders={folders}
              value={folderId}
              disabled={disabled}
              compact={compact}
              onChange={onFolderChange}
            />
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border-glass bg-surface-hover/50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-text-secondary">Important</div>
          <div className="text-[11px] text-text-muted leading-snug">
            Surfaces in Important filter and sorts to the top
          </div>
        </div>
        <TaskStarButton
          starred={starred}
          disabled={disabled}
          onToggle={() => onStarredChange(!starred)}
        />
      </div>
      {folders.length > 0 ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            Folder
          </span>
          <TaskFolderPicker
            folders={folders}
            value={folderId}
            disabled={disabled}
            compact={compact}
            onChange={onFolderChange}
          />
        </label>
      ) : null}
    </div>
  );
}