"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeTag } from "@/lib/files/parseTagsInput";

interface TagMultiSelectProps {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  /** Compact icon trigger for mobile files toolbar */
  variant?: "default" | "toolbar";
}

export function TagMultiSelect({
  tags,
  selected,
  onChange,
  disabled,
  variant = "default",
}: TagMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSelected = useMemo(
    () => selected.map(normalizeTag).filter(Boolean),
    [selected],
  );

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const tag of tags) {
      const n = normalizeTag(tag);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      merged.push(n);
    }
    return merged.sort((a, b) => a.localeCompare(b));
  }, [tags]);

  const q = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    const available = pool.filter((t) => !normalizedSelected.includes(t));
    if (!q) return available.slice(0, 12);
    return available.filter((t) => t.includes(q)).slice(0, 12);
  }, [pool, q, normalizedSelected]);

  const isToolbar = variant === "toolbar";
  const expanded = isToolbar ? menuOpen : menuOpen || normalizedSelected.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || normalizedSelected.includes(tag)) return;
    onChange([...normalizedSelected, tag]);
    setQuery("");
    setMenuOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeTag = (tag: string) => {
    const next = normalizedSelected.filter((t) => t !== tag);
    onChange(next);
    if (next.length === 0) {
      setMenuOpen(false);
      setQuery("");
    } else {
      setMenuOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const clearAll = () => {
    onChange([]);
    setQuery("");
    setMenuOpen(false);
  };

  const openPanel = () => {
    if (disabled || pool.length === 0) return;
    setMenuOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const panelContent = (
    <>
      {normalizedSelected.length > 0 && (
        <div className="flex items-start gap-2">
          <ul className="flex flex-wrap gap-1.5 flex-1 min-w-0" aria-label="Active tag filters">
            {normalizedSelected.map((tag) => (
              <li key={tag}>
                <span className="inline-flex items-center gap-1 rounded-full border border-neon-purple/35 bg-neon-purple/10 px-2.5 py-1 text-xs text-neon-purple-tint">
                  {tag}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 hover:bg-surface-hover"
                      aria-label={`Remove filter ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!disabled && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 text-[10px] text-text-muted hover:text-text-secondary px-1 py-0.5"
              aria-label="Clear all tag filters"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled || pool.length === 0}
          onChange={(e) => {
            setQuery(e.target.value);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) {
              e.preventDefault();
              addTag(suggestions[0]);
            }
            if (e.key === "Escape") {
              setMenuOpen(false);
              setQuery("");
            }
          }}
          placeholder={
            normalizedSelected.length > 0
              ? "Search to add another tag…"
              : "Search tags to filter…"
          }
          className={cn(
            "w-full bg-bg-secondary border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint",
            normalizedSelected.length > 0
              ? "border-neon-purple/35 text-neon-purple-tint"
              : "border-border-glass text-text-secondary",
            (disabled || pool.length === 0) && "opacity-50 cursor-not-allowed",
          )}
          aria-expanded={menuOpen}
          aria-autocomplete="list"
          role="combobox"
          aria-label="Filter by tags"
        />

        {menuOpen && !disabled && suggestions.length > 0 && (
          <ul
            className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border-glass bg-bg-card py-1 shadow-xl"
            role="listbox"
            aria-label="Matching tags"
          >
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  role="option"
                  onClick={() => addTag(tag)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-text-primary hover:bg-surface-hover"
                >
                  <Tag className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}

        {menuOpen && !disabled && q && suggestions.length === 0 && (
          <div className="absolute left-0 right-0 z-40 mt-1 rounded-xl border border-border-glass bg-bg-card px-3 py-2.5 text-sm text-text-muted shadow-xl">
            No tags match &ldquo;{query.trim()}&rdquo;
          </div>
        )}
      </div>

      {normalizedSelected.length > 1 && !isToolbar && (
        <p className="text-[10px] text-text-muted leading-snug">
          Showing files that have every selected tag.
        </p>
      )}
    </>
  );

  if (!expanded) {
    if (isToolbar) {
      return (
        <div ref={rootRef} className="relative shrink-0">
          <button
            type="button"
            disabled={disabled || pool.length === 0}
            onClick={openPanel}
            className={cn(
              "files-tag-filter-btn flex items-center justify-center rounded-xl border min-h-[44px] min-w-[44px] transition",
              normalizedSelected.length > 0
                ? "border-neon-purple/35 bg-neon-purple/10 text-neon-purple-tint"
                : "border-border-glass bg-bg-secondary text-text-secondary",
              (disabled || pool.length === 0) && "opacity-50 cursor-not-allowed",
            )}
            aria-haspopup="listbox"
            aria-label={
              normalizedSelected.length > 0
                ? `Filter by tags (${normalizedSelected.length} selected)`
                : "Filter by tags"
            }
          >
            <Tag className="h-4 w-4 shrink-0" />
            {normalizedSelected.length > 0 && (
              <span className="files-tag-filter-btn__count">{normalizedSelected.length}</span>
            )}
          </button>
        </div>
      );
    }

    return (
      <div ref={rootRef}>
        <button
          type="button"
          disabled={disabled || pool.length === 0}
          onClick={openPanel}
          className={cn(
            "w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition min-h-[44px]",
            "border-border-glass bg-bg-secondary text-text-secondary hover:border-border-glass",
            (disabled || pool.length === 0) && "opacity-50 cursor-not-allowed",
          )}
          aria-haspopup="listbox"
        >
          <Tag className="h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1 truncate">{pool.length === 0 ? "No tags yet" : "Filter by tags"}</span>
          <Search className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </div>
    );
  }

  if (isToolbar) {
    return (
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          disabled={disabled || pool.length === 0}
          onClick={openPanel}
          className={cn(
            "files-tag-filter-btn files-tag-filter-btn--open flex items-center justify-center rounded-xl border min-h-[44px] min-w-[44px] transition",
            "border-neon-purple/35 bg-neon-purple/10 text-neon-purple-tint",
            (disabled || pool.length === 0) && "opacity-50 cursor-not-allowed",
          )}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label="Filter by tags"
        >
          <Tag className="h-4 w-4 shrink-0" />
          {normalizedSelected.length > 0 && (
            <span className="files-tag-filter-btn__count">{normalizedSelected.length}</span>
          )}
        </button>
        <div className="files-tag-filter-popover absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2.5rem))] rounded-xl border border-border-glass bg-bg-card p-3 shadow-2xl space-y-2">
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {panelContent}
    </div>
  );
}