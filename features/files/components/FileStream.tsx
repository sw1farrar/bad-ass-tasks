"use client";

import React from "react";
import { FileText, Mail, Paperclip, Receipt, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileRecordType, Note } from "@/types";
import { safeFormatTimestampIso } from "@/lib/datetime";

interface FileStreamProps {
  files: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  attachmentCounts?: Record<string, number>;
  emptyMessage?: string;
}

function RecordIcon({ type }: { type?: FileRecordType }) {
  const className = "h-4 w-4 shrink-0 text-[#c084fc]/80";
  switch (type) {
    case "email":
      return <Mail className={className} />;
    case "receipt":
      return <Receipt className={className} />;
    case "document":
      return <File className={className} />;
    case "note":
      return <FileText className={className} />;
    default:
      return <File className={className} />;
  }
}

export function FileStream({
  files,
  selectedId,
  onSelect,
  attachmentCounts = {},
  emptyMessage = "No files here yet.",
}: FileStreamProps) {
  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-[#71717a]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-white/5" role="listbox" aria-label="Files">
      {files.map((file) => {
        const isSelected = file.id === selectedId;
        const attachCount = attachmentCounts[file.id] ?? 0;
        const displayTags = (file.tags ?? []).filter((t) => t !== "from-email").slice(0, 3);
        const dateLabel = safeFormatTimestampIso(
          file.filedAt ?? file.updatedAt,
          "MMM d, yyyy",
          "",
        );

        return (
          <li key={file.id}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(file.id)}
              className={cn(
                "w-full text-left px-3 py-3 transition",
                isSelected ? "bg-[#c084fc]/10" : "hover:bg-white/[0.03]",
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <RecordIcon type={file.recordType} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate text-[#f4f4f5]">
                    {file.title || "Untitled"}
                  </div>
                  {file.memo && (
                    <div className="text-xs text-[#71717a] line-clamp-1 mt-0.5">{file.memo}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {displayTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#a1a1aa] border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                    {dateLabel && (
                      <span className="text-[10px] text-[#52525b] font-mono">{dateLabel}</span>
                    )}
                    {attachCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#71717a]">
                        <Paperclip className="h-3 w-3" />
                        {attachCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}