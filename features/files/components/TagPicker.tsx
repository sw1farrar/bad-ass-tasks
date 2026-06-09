"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeTag } from "@/lib/files/parseTagsInput";

interface TagPickerProps {
  availableTags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function TagPicker({
  availableTags,
  selected,
  onChange,
  placeholder = "Search or add tags…",
  disabled,
  id,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSelected = useMemo(
    () => selected.map(normalizeTag).filter(Boolean),
    [selected],
  );

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const tag of [...availableTags, ...normalizedSelected]) {
      const n = normalizeTag(tag);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      merged.push(n);
    }
    return merged.sort((a, b) => a.localeCompare(b));
  }, [availableTags, normalizedSelected]);

  const q = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!q) {
      return pool.filter((t) => !normalizedSelected.includes(t)).slice(0, 12);
    }
    return pool
      .filter((t) => !normalizedSelected.includes(t) && t.includes(q))
      .slice(0, 12);
  }, [pool, q, normalizedSelected]);

  const canCreate =
    q.length > 0 && !normalizedSelected.includes(q) && !pool.includes(q);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || normalizedSelected.includes(tag)) return;
    onChange([...normalizedSelected, tag]);
    setQuery("");
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(normalizedSelected.filter((t) => t !== tag));
  };

  return (
    <div ref={rootRef} className="space-y-2">
      {normalizedSelected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {normalizedSelected.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#c084fc]/35 bg-[#c084fc]/10 px-2.5 py-1 text-xs text-[#e9d5ff]">
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 hover:bg-white/10"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b] pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) {
              e.preventDefault();
              addTag(q);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full input pl-9 pr-3 py-2.5 rounded-xl text-sm",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />

        {open && !disabled && (suggestions.length > 0 || canCreate) && (
          <ul
            className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#141416] py-1 shadow-xl"
            role="listbox"
          >
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  role="option"
                  onClick={() => {
                    addTag(tag);
                    setOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[#e4e4e7] hover:bg-white/5"
                >
                  <Tag className="h-3.5 w-3.5 shrink-0 text-[#71717a]" />
                  {tag}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  onClick={() => addTag(q)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[#c084fc] hover:bg-[#c084fc]/10 border-t border-white/10"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Add tag &ldquo;{q}&rdquo;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}