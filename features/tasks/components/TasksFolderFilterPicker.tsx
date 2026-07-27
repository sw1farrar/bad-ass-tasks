"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Folder, FolderCog, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredPopoverPosition } from "@/lib/hooks/useAnchoredPopoverPosition";
import type { TaskFolder } from "@/types";
import {
  TASKS_FOLDER_UNFILED,
  folderFilterForStore,
  folderFilterSummary,
  isFolderFilterActive,
  normalizeFolderFilter,
  toggleFolderFilterToken,
  type TasksFolderFilterMode,
} from "@/features/tasks/lib/folderFilter";
import { TaskFoldersManageModal } from "./TaskFoldersManageModal";

interface TasksFolderFilterPickerProps {
  folders: TaskFolder[];
  value: TasksFolderFilterMode;
  onChange: (next: TasksFolderFilterMode) => void;
  className?: string;
  /** Compact chip sizing to match organize-bar filters */
  compact?: boolean;
  /** When provided, shows Manage folders action + modal in the dropdown */
  onAddFolder?: (name: string) => Promise<unknown>;
  onRenameFolder?: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder?: (id: string) => Promise<unknown>;
}

export function TasksFolderFilterPicker({
  folders,
  value,
  onChange,
  className,
  compact = true,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: TasksFolderFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canManage = Boolean(onAddFolder && onRenameFolder && onDeleteFolder);

  const selected = useMemo(() => normalizeFolderFilter(value), [value]);
  const active = isFolderFilterActive(value);
  const label = folderFilterSummary(selected, folders);

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  const q = query.trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    if (!q) return sortedFolders;
    return sortedFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [sortedFolders, q]);

  const showUnfiled =
    !q ||
    "unfiled".includes(q) ||
    "none".includes(q) ||
    "no folder".includes(q);

  const popoverPosition = useAnchoredPopoverPosition({
    open,
    anchorRef: triggerRef,
    panelRef,
    estimatedWidth: 288,
    estimatedHeight: Math.min(360, 52 + 36 * (1 + filteredFolders.length + (showUnfiled ? 1 : 0))),
    horizontalAlign: "auto",
    boundaryMode: "viewport",
    sizeMode: "content",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const focusTimer = requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [open]);

  const commit = (nextSelected: string[]) => {
    onChange(folderFilterForStore(nextSelected));
  };

  const selectAll = () => {
    commit([]);
  };

  const toggleToken = (token: string) => {
    commit(toggleFolderFilterToken(selected, token));
  };

  const isAllSelected = selected.length === 0;

  const panel =
    open && mounted && popoverPosition ? (
      <div
        ref={panelRef}
        className="tasks-folder-filter-picker__panel fixed z-[80] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-border-glass bg-bg-card p-2 shadow-2xl"
        style={{
          top: popoverPosition.top,
          left: popoverPosition.left,
          maxHeight: popoverPosition.maxHeight,
        }}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Filter by folders"
      >
        <div className="relative mb-2">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search folders…"
            className="input w-full rounded-lg border border-border-glass bg-surface-hover py-1.5 pl-8 pr-8 text-xs"
            aria-label="Search folders"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="max-h-56 overflow-y-auto overscroll-contain space-y-0.5">
          {!q ? (
            <FolderOption
              label="All folders"
              selected={isAllSelected}
              onSelect={selectAll}
            />
          ) : null}

          {showUnfiled ? (
            <FolderOption
              label="Unfiled"
              selected={selected.includes(TASKS_FOLDER_UNFILED)}
              onSelect={() => toggleToken(TASKS_FOLDER_UNFILED)}
              multi
            />
          ) : null}

          {filteredFolders.map((folder) => (
            <FolderOption
              key={folder.id}
              label={folder.name}
              selected={selected.includes(folder.id)}
              onSelect={() => toggleToken(folder.id)}
              multi
            />
          ))}

          {q && !showUnfiled && filteredFolders.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-xs text-text-muted">
              No folders match “{query.trim()}”
            </p>
          ) : null}
        </div>

        {active || canManage ? (
          <div className="mt-2 space-y-1 border-t border-border-glass pt-2">
            {active ? (
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="min-w-0 truncate text-[11px] text-text-secondary">{label}</p>
                <button
                  type="button"
                  onClick={selectAll}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-neon-purple hover:bg-neon-purple/10"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-text-secondary transition hover:bg-surface-hover hover:text-neon-purple"
              >
                <FolderCog className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Manage folders
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className={cn("tasks-folder-filter-picker relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Folder filter: ${label}`}
        className={cn(
          "tasks-folder-filter-picker__trigger inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap transition",
          compact
            ? "h-6 px-2 text-[11px] leading-none"
            : "px-3 py-1.5 text-xs",
          active || open
            ? "is-active border-neon-purple/50 bg-neon-purple/15 text-neon-purple"
            : "border-border-glass bg-surface-hover text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
        )}
      >
        <Folder className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
        <span className="max-w-[9rem] truncate">{label}</span>
        {active && selected.length > 1 ? (
          <span className="tabular-nums text-[10px] opacity-80">({selected.length})</span>
        ) : null}
        <ChevronDown
          className={cn(
            "opacity-70 transition-transform",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}

      {canManage && onAddFolder && onRenameFolder && onDeleteFolder ? (
        <TaskFoldersManageModal
          open={manageOpen}
          onOpenChange={setManageOpen}
          folders={folders}
          onAddFolder={onAddFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
        />
      ) : null}
    </div>
  );
}

function FolderOption({
  label,
  selected,
  onSelect,
  multi = false,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition",
        selected
          ? "bg-neon-purple/12 text-neon-purple"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center border",
          multi ? "rounded-[4px]" : "rounded-full",
          selected
            ? "border-neon-purple bg-neon-purple text-accent-on"
            : "border-border-glass bg-surface-hover",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
