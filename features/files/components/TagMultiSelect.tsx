"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagMultiSelectProps {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagMultiSelect({
  tags,
  selected,
  onChange,
  disabled,
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggleTag = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  const label =
    selected.length === 0
      ? "Filter by tags"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} tags selected`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || tags.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition min-h-[44px]",
          selected.length > 0
            ? "border-[#c084fc]/35 bg-[#c084fc]/10 text-[#e9d5ff]"
            : "border-white/10 bg-[#111114] text-[#a1a1aa] hover:border-white/20",
          (disabled || tags.length === 0) && "opacity-50 cursor-not-allowed",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Tag className="h-4 w-4 shrink-0 opacity-70" />
        <span className="flex-1 truncate">{tags.length === 0 ? "No tags yet" : label}</span>
        {selected.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 rounded-md p-0.5 hover:bg-white/10"
            aria-label="Clear tag filter"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange([]);
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")}
          />
        )}
      </button>

      {open && tags.length > 0 && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#141416] py-1 shadow-xl"
          role="listbox"
          aria-label="Filter by tags"
          aria-multiselectable
        >
          {tags.map((tag) => {
            const checked = selected.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/5",
                  checked && "bg-[#c084fc]/10 text-[#e9d5ff]",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    checked
                      ? "border-[#c084fc] bg-[#c084fc]/30"
                      : "border-white/20 bg-transparent",
                  )}
                  aria-hidden
                >
                  {checked && <span className="text-[10px] font-bold">✓</span>}
                </span>
                <span className="truncate">{tag}</span>
              </button>
            );
          })}
          {selected.length > 1 && (
            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-[#71717a]">
              Showing files that match all selected tags
            </div>
          )}
        </div>
      )}
    </div>
  );
}