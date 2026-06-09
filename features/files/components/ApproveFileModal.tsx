"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRecordType, Note } from "@/types";
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
}

export function ApproveFileModal({
  file,
  isOpen,
  onClose,
  workspaceTags,
  remainingInQueue,
  onApprove,
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

  const handleApprove = async (result: ApproveFileResult) => {
    setSaving(result);
    try {
      await onApprove(
        {
          title: title.trim() || "Untitled",
          tags: tags.length > 0 ? tags : ["uncategorized"],
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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl p-5"
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
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#71717a]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {remainingInQueue > 0 && (
          <p className="text-xs text-[#71717a] mb-4">
            {remainingInQueue} in queue
            {hasNext ? " — file & next keeps you moving" : ""}
          </p>
        )}

        <div className="space-y-3">
          <label className="block text-xs text-[#a1a1aa]">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            />
          </label>

          <div>
            <div className="text-xs text-[#a1a1aa] mb-1">Tags</div>
            <TagPicker
              availableTags={workspaceTags}
              selected={tags}
              onChange={setTags}
              disabled={!!saving}
            />
          </div>

          <label className="block text-xs text-[#a1a1aa]">
            Memo
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm resize-none"
              placeholder="Short note for search and triage"
            />
          </label>

          <label className="block text-xs text-[#a1a1aa]">
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
          {hasNext && (
            <button
              type="button"
              onClick={() => void handleApprove("close")}
              disabled={!!saving}
              className={cn(
                "btn btn-ghost flex-1 py-2.5 text-sm border border-white/10",
                saving === "close" && "opacity-60",
              )}
            >
              {saving === "close" ? "Filing…" : "File only"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleApprove(hasNext ? "next" : "close")}
            disabled={!!saving}
            className={cn(
              "btn btn-primary flex-1 py-2.5 text-sm",
              (saving === "next" || saving === "close") && "opacity-60",
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