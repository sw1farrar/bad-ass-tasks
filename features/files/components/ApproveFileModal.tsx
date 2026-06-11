"use client";

import React, { useEffect, useState } from "react";
import { X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRecordType, Note } from "@/types";
import { hasUserFilingTags } from "@/lib/files/fileFilters";
import { FILE_RECORD_TYPES, recordTypeLabel } from "@/lib/files/fileTypes";
import { TagPicker } from "./TagPicker";

export type ApproveFileResult = "close" | "next";

interface ApproveFileModalProps {
  file: Note | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceTags: string[];
  remainingInQueue: number;
  onApprove: (
    input: {
      title: string;
      tags: string[];
      memo: string;
      recordType: FileRecordType;
    },
    result: ApproveFileResult,
  ) => Promise<void>;
  onEdit?: () => void;
}

export function ApproveFileModal({
  file,
  isOpen,
  onClose,
  workspaceTags,
  remainingInQueue,
  onApprove,
  onEdit,
}: ApproveFileModalProps) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [recordType, setRecordType] = useState<FileRecordType>("note");
  const [saving, setSaving] = useState<ApproveFileResult | null>(null);

  useEffect(() => {
    if (!file || !isOpen) return;
    setTitle(file.title || "Untitled");
    setTags((file.tags ?? []).filter((t) => t !== "from-email").map((t) => t.toLowerCase()));
    setMemo(file.memo ?? "");
    setRecordType(file.recordType ?? "note");
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const canFile = hasUserFilingTags(tags);

  const handleApprove = async (result: ApproveFileResult) => {
    if (!canFile) return;
    setSaving(result);
    try {
      await onApprove(
        {
          title: title.trim() || "Untitled",
          tags,
          memo: memo.trim(),
          recordType,
        },
        result,
      );
      if (result === "close") onClose();
    } finally {
      setSaving(null);
    }
  };

  const hasNext = remainingInQueue > 1;

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
        aria-labelledby="review-file-title"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 id="review-file-title" className="text-lg font-semibold tracking-tight">
            Review file
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
        {remainingInQueue > 0 && (
          <p className="text-xs text-text-muted mb-4">
            {remainingInQueue} in queue
            {hasNext ? " — file & next keeps you moving" : ""}
          </p>
        )}

        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            />
          </label>

          <div>
            <div className="text-xs text-text-secondary mb-1">
              Tags <span className="text-neon-purple">(required)</span>
            </div>
            <TagPicker
              availableTags={workspaceTags}
              selected={tags}
              onChange={setTags}
              disabled={!!saving}
            />
            {!canFile && (
              <p className="mt-1.5 text-xs text-[var(--priority-p2)]">Add at least one tag before filing.</p>
            )}
          </div>

          <label className="block text-xs text-text-secondary">
            Memo <span className="text-text-faint">(optional)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm resize-none"
              placeholder="e.g. March electric bill from Acme"
              aria-describedby="review-memo-hint"
            />
            <span id="review-memo-hint" className="mt-1 block text-[10px] text-text-faint leading-snug">
              One line shown under the title in your file list and included when you search files.
            </span>
          </label>

          <label className="block text-xs text-text-secondary">
            Type
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as FileRecordType)}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            >
              {FILE_RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {recordTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 py-2.5 text-sm">
            Cancel
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={!!saving}
              className="btn btn-ghost flex-1 py-2.5 text-sm border border-border-glass flex items-center justify-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              View/Edit
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => void handleApprove("close")}
              disabled={!!saving || !canFile}
              className={cn(
                "btn btn-ghost flex-1 py-2.5 text-sm border border-border-glass",
                (saving === "close" || !canFile) && "opacity-60",
              )}
            >
              {saving === "close" ? "Filing…" : "File only"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleApprove(hasNext ? "next" : "close")}
            disabled={!!saving || !canFile}
            className={cn(
              "btn btn-primary flex-1 py-2.5 text-sm",
              (saving === "next" || saving === "close" || !canFile) && "opacity-60",
            )}
          >
            {saving
              ? "Filing…"
              : hasNext
                ? "File & next"
                : "File"}
          </button>
        </div>
      </div>
    </div>
  );
}