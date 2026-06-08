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

  const handleApprove = async () => {
    setSaving(true);
    try {
      const tags = parseTagsInput(tagsInput);
      await onApprove({
        tags: tags.length > 0 ? tags : ["uncategorized"],
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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl p-5"
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
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#71717a]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-[#71717a] mb-4 leading-relaxed">
          Shared tags and memo apply to every selected file. Titles and types stay as-is.
        </p>

        <ul className="mb-4 max-h-32 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
          {files.map((file) => (
            <li key={file.id} className="px-3 py-2 text-sm text-[#e5e5e7] truncate">
              {file.title || "Untitled"}
            </li>
          ))}
        </ul>

        <div className="space-y-3">
          <label className="block text-xs text-[#a1a1aa]">
            Tags (comma-separated)
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="receipt, acme, 2026"
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            />
          </label>

          <label className="block text-xs text-[#a1a1aa]">
            Memo
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm resize-none"
              placeholder="Shared triage note"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={saving}
            className={cn("btn btn-primary flex-1 py-2.5 text-sm", saving && "opacity-60")}
          >
            {saving ? "Filing…" : `Approve ${files.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}