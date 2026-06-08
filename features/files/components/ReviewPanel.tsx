"use client";

import React, { useEffect, useState } from "react";
import { Check, Paperclip, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { recordTypeLabel } from "@/lib/files/fileTypes";
import { safeFormatTimestampIso } from "@/lib/datetime";

interface ReviewPanelProps {
  files: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onBulkApprove?: (ids: string[]) => void;
  attachmentCounts?: Record<string, number>;
}

export function ReviewPanel({
  files,
  selectedId,
  onSelect,
  onApprove,
  onBulkApprove,
  attachmentCounts = {},
}: ReviewPanelProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => files.some((f) => f.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [files]);

  const allChecked = files.length > 0 && checkedIds.size === files.length;
  const someChecked = checkedIds.size > 0;

  const toggleOne = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(files.map((f) => f.id)));
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-lg font-medium text-[#f4f4f5] mb-1">Review is clear</div>
        <p className="text-sm text-[#71717a] max-w-xs">
          New emails, uploads, and files you create will appear here for tagging and approval.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {files.length > 1 && onBulkApprove && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#0a0a0a]/80">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa] hover:text-white"
          >
            {allChecked ? (
              <CheckSquare className="h-4 w-4 text-[#c084fc]" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {allChecked ? "Clear" : "Select all"}
          </button>
          {someChecked && (
            <button
              type="button"
              onClick={() => onBulkApprove([...checkedIds])}
              className="rounded-lg bg-[#c084fc]/15 border border-[#c084fc]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[#e9d5ff] hover:bg-[#c084fc]/25"
            >
              Approve {checkedIds.size}
            </button>
          )}
        </div>
      )}

      <ul className="flex-1 overflow-y-auto divide-y divide-white/5" aria-label="Review queue">
        {files.map((file) => {
          const isSelected = file.id === selectedId;
          const isChecked = checkedIds.has(file.id);
          const attachCount = attachmentCounts[file.id] ?? 0;
          const snippet = (file.searchPlain ?? file.memo ?? "").slice(0, 120);

          return (
            <li key={file.id} className={cn(isSelected && "bg-[#c084fc]/5")}>
              <div className="px-3 py-3 flex gap-2 items-start">
                {onBulkApprove && files.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleOne(file.id)}
                    className="shrink-0 mt-0.5 text-[#71717a] hover:text-[#c084fc]"
                    aria-label={isChecked ? "Deselect file" : "Select file"}
                  >
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-[#c084fc]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onSelect(file.id)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-[#c084fc] font-semibold">
                      {recordTypeLabel(file.recordType ?? "note")}
                    </span>
                    <span className="text-[10px] text-[#52525b] font-mono">
                      {safeFormatTimestampIso(file.createdAt, "MMM d", "")}
                    </span>
                  </div>
                  <div className="font-medium text-sm text-[#f4f4f5] truncate">
                    {file.title || "Untitled"}
                  </div>
                  {snippet && (
                    <div className="text-xs text-[#71717a] line-clamp-2 mt-1">{snippet}</div>
                  )}
                  {attachCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#71717a] mt-1">
                      <Paperclip className="h-3 w-3" />
                      {attachCount} attachment{attachCount === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(file.id)}
                  className="shrink-0 min-h-[40px] px-3 rounded-xl bg-[#c084fc]/15 border border-[#c084fc]/35 text-[#e9d5ff] text-xs font-semibold hover:bg-[#c084fc]/25 flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {someChecked && onBulkApprove && (
        <div className="shrink-0 p-3 border-t border-white/10 bg-[#0a0a0a]">
          <button
            type="button"
            onClick={() => onBulkApprove([...checkedIds])}
            className="w-full btn btn-primary py-2.5 text-sm"
          >
            Approve {checkedIds.size} selected
          </button>
        </div>
      )}
    </div>
  );
}