"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Paperclip, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { TipTapEditor } from "@/features/notes/editor";
import type { FileRecordType } from "@/types";
import { FILE_RECORD_TYPES, recordTypeLabel } from "@/lib/files/fileTypes";
import { parseTagsInput } from "@/lib/files/parseTagsInput";

export type CaptureFileSubmitMode = "review" | "file";

export interface CaptureFileInput {
  title: string;
  content: string;
  tags: string[];
  memo: string;
  recordType: FileRecordType;
  attachments: File[];
}

interface CaptureFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceTags?: string[];
  isLive?: boolean;
  onSubmit: (input: CaptureFileInput, mode: CaptureFileSubmitMode) => Promise<void>;
}

function emptyState() {
  return {
    title: "",
    tagsInput: "",
    memo: "",
    recordType: "note" as FileRecordType,
    content: "",
    attachments: [] as File[],
  };
}

export function CaptureFileModal({
  isOpen,
  onClose,
  workspaceTags = [],
  isLive = true,
  onSubmit,
}: CaptureFileModalProps) {
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");
  const [recordType, setRecordType] = useState<FileRecordType>("note");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState<CaptureFileSubmitMode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const next = emptyState();
    setTitle(next.title);
    setTagsInput(next.tagsInput);
    setMemo(next.memo);
    setRecordType(next.recordType);
    setContent(next.content);
    setAttachments(next.attachments);
    setSaving(null);
    setDragOver(false);
  }, [isOpen]);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files?.length) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const appendTag = (tag: string) => {
    const existing = parseTagsInput(tagsInput);
    if (existing.includes(tag)) return;
    setTagsInput(existing.length ? `${existing.join(", ")}, ${tag}` : tag);
  };

  const handleSubmit = async (mode: CaptureFileSubmitMode) => {
    if (saving) return;
    setSaving(mode);
    try {
      const tags = parseTagsInput(tagsInput);
      await onSubmit(
        {
          title: title.trim() || "Untitled",
          content,
          tags,
          memo: memo.trim(),
          recordType,
          attachments,
        },
        mode,
      );
      onClose();
    } finally {
      setSaving(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[290] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
        aria-label="Close"
      />
      <div
        className="relative flex flex-col w-full sm:max-w-4xl max-h-[94vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="capture-file-title"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div>
            <h2 id="capture-file-title" className="text-lg font-semibold tracking-tight text-[#f4f4f5]">
              Capture file
            </h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Add everything at once — tags, notes, images, and attachments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!saving}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#71717a]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-[#a1a1aa] sm:col-span-2">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is this file?"
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
                autoFocus
              />
            </label>

            <label className="block text-xs text-[#a1a1aa]">
              Tags
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="receipt, acme, 2026"
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
              />
            </label>

            <label className="block text-xs text-[#a1a1aa]">
              Type
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as FileRecordType)}
                className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm"
              >
                {FILE_RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {recordTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {workspaceTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {workspaceTags.slice(0, 12).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendTag(tag)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#a1a1aa] hover:border-[#c084fc]/40 hover:text-[#e9d5ff]"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <label className="block text-xs text-[#a1a1aa]">
            Memo <span className="text-[#52525b]">(short note for search)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full input px-3 py-2.5 rounded-xl text-sm resize-none"
              placeholder="Optional triage note"
            />
          </label>

          <div>
            <div className="text-xs text-[#a1a1aa] mb-1.5">Notes & images</div>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden min-h-[220px]">
              <TipTapEditor
                content={content}
                onChange={setContent}
                placeholder="Jot notes, paste images, format text…"
                minHeight="220px"
                compactToolbar
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-[#a1a1aa] mb-1.5">Attachments</div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "rounded-xl border border-dashed px-4 py-5 text-center transition",
                dragOver
                  ? "border-[#c084fc]/50 bg-[#c084fc]/5"
                  : "border-white/15 bg-[#0a0a0a]/60",
              )}
            >
              <Upload className="h-5 w-5 mx-auto text-[#71717a] mb-2" />
              <p className="text-sm text-[#a1a1aa]">
                Drop files here or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#c084fc] hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-[10px] text-[#52525b] mt-1">PDF, images, docs — up to 50 MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#111114] px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#71717a]" />
                    <span className="flex-1 min-w-0 truncate text-[#e4e4e7]">{file.name}</span>
                    <span className="text-[10px] text-[#52525b] shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-[#71717a] hover:text-white px-1"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isLive && (
            <p className="text-xs text-[#71717a] rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              Demo mode: captures save locally. Live Supabase unlocks attachment uploads and email
              intake.
            </p>
          )}
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 px-5 py-4 border-t border-white/10 bg-[#0a0a0a]/80">
          <button
            type="button"
            onClick={onClose}
            disabled={!!saving}
            className="btn btn-ghost flex-1 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit("file")}
            disabled={!!saving}
            className={cn(
              "btn btn-ghost flex-1 py-2.5 text-sm border border-white/10",
              saving === "file" && "opacity-60",
            )}
          >
            {saving === "file" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Filing…
              </span>
            ) : (
              "File now"
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit("review")}
            disabled={!!saving}
            className={cn("btn btn-primary flex-1 py-2.5 text-sm", saving === "review" && "opacity-60")}
          >
            {saving === "review" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </span>
            ) : (
              "Add to Review"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}