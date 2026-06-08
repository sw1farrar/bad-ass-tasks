"use client";

import React from "react";
import { Check, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { recordTypeLabel } from "@/lib/files/fileTypes";
import { safeFormatTimestampIso } from "@/lib/datetime";

interface ReviewPanelProps {
  files: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  attachmentCounts?: Record<string, number>;
}

export function ReviewPanel({
  files,
  selectedId,
  onSelect,
  onApprove,
  attachmentCounts = {},
}: ReviewPanelProps) {
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
    <ul className="flex-1 overflow-y-auto divide-y divide-white/5" aria-label="Review queue">
      {files.map((file) => {
        const isSelected = file.id === selectedId;
        const attachCount = attachmentCounts[file.id] ?? 0;
        const snippet = (file.searchPlain ?? file.memo ?? "").slice(0, 120);

        return (
          <li key={file.id} className={cn(isSelected && "bg-[#c084fc]/5")}>
            <div className="px-3 py-3 flex gap-2 items-start">
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
  );
}