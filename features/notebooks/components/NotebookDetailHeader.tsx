"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Notebook } from "@/types";

interface NotebookDetailHeaderProps {
  notebook: Notebook;
  onRename: (name: string) => void;
  onDelete: () => void;
  /** Enter rename mode with name selected (new notebook flow on desktop). */
  focusRename?: boolean;
  onFocusRenameConsumed?: () => void;
}

export function NotebookDetailHeader({
  notebook,
  onRename,
  onDelete,
  focusRename = false,
  onFocusRenameConsumed,
}: NotebookDetailHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notebook.name);

  useEffect(() => {
    setDraft(notebook.name);
  }, [notebook.id, notebook.name]);

  useEffect(() => {
    if (!focusRename) return;
    setEditing(true);
    setDraft(notebook.name);
  }, [focusRename, notebook.id, notebook.name]);

  useEffect(() => {
    if (!focusRename || !editing) return;
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      onFocusRenameConsumed?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRename, editing, onFocusRenameConsumed]);

  const commit = () => {
    const name = draft.trim() || "Untitled notebook";
    setDraft(name);
    setEditing(false);
    if (name !== notebook.name) onRename(name);
  };

  return (
    <div className="notebooks-detail-header flex items-center gap-2 px-4 py-2.5 border-b border-border-glass bg-bg shrink-0 min-w-0">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(notebook.name);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-bg-secondary border border-neon-purple/30 rounded-xl px-3 py-1.5 text-sm font-semibold text-text-primary focus:outline-none focus:border-neon-purple/50"
          aria-label="Notebook name"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setDraft(notebook.name);
          }}
          className="group flex flex-1 min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 -ml-2 text-left hover:bg-surface-hover transition"
          aria-label={`Rename ${notebook.name}`}
        >
          <span className="flex-1 min-w-0 text-sm font-semibold truncate text-text-primary">
            {notebook.name}
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-text-muted opacity-70 group-hover:opacity-100 group-hover:text-neon-purple" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
        aria-label={`Delete ${notebook.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}