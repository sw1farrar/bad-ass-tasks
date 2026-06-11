"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

interface BulkApproveFilesModalProps {
  files: Note[];
  isOpen: boolean;
  onClose: () => void;
  onApprove: (input: { tags: string[]; memo: string }) => Promise<void>;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,#]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function BulkApproveFilesModal({
  files,
  isOpen,
  onClose,
  onApprove,
}: BulkApproveFilesModalProps) {
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTagsInput("");
    setMemo("");
  }, [isOpen, files.length]);

  if (!isOpen || files.length === 0) return null;

  const tags = parseTagsInput(tagsInput);
  const canFile = tags.length > 0;

  const handleApprove = async () => {
    if (!canFile) return;
    setSaving(true);
    try {
      await onApprove({
        tags,
        memo: memo.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 overlay-scrim backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border-glass modal-panel bg-bg-panel shadow-2xl p-5"
        role="dialog"
        aria-labelledby="bulk-approve-title"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 id="bulk-approve-title" className="text-lg font-semibold tracking-tight">
            Approve {files.length} file{files.length === 1 ? "" : "s"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          The same tags and memo are applied to every selected file. Titles and types stay as-is.
        </p>

        <ul className="mb-4 max-h-32 overflow-y-auto rounded-xl border border-border-glass divide-y divide-border-glass/60">
          {files.map((file) => (
            <li key={file.id} className="px-3 py-2 text-sm text-text-primary truncate">
              {file.title || "Untitled"}
            </li>
          ))}
        </ul>

        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">
            Tags (comma-separated) <span className="text-neon-purple">(required)</span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="receipt, acme, 2026"
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            />
            {!canFile && (
              <span className="mt-1.5 block text-xs text-[var(--priority-p2)]">
                Add at least one tag before filing.
              </span>
            )}
          </label>

          <label className="block text-xs text-text-secondary">
            Memo <span className="text-text-faint">(optional)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm resize-none"
              placeholder="e.g. Q1 expenses — same line on every file"
              aria-describedby="bulk-memo-hint"
            />
            <span id="bulk-memo-hint" className="mt-1 block text-[10px] text-text-faint leading-snug">
              Shown under each file&apos;s title in the list and included when you search files.
            </span>
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={saving || !canFile}
            className={cn("btn btn-primary flex-1 py-2.5 text-sm", (saving || !canFile) && "opacity-60")}
          >
            {saving ? "Filing…" : `Approve ${files.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}