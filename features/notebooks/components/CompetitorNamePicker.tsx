"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompetitorNameSuggestion } from "@/lib/notebooks/competitorAggregates";
import { formatCompetitorCurrency } from "./MarketShareVisuals";

interface CompetitorNamePickerProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: CompetitorNameSuggestion[];
  disabled?: boolean;
  placeholder?: string;
}

export function CompetitorNamePicker({
  value,
  onChange,
  suggestions,
  disabled,
  placeholder = "Select or add competitor",
}: CompetitorNamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, suggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectSuggestion = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-faint pointer-events-none" />
        <input
          value={open ? query : value}
          onChange={(e) => {
            const next = e.target.value;
            if (open) {
              setQuery(next);
            } else {
              onChange(next);
            }
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (e.key === "Enter" && open && filtered.length === 1) {
              e.preventDefault();
              selectSuggestion(filtered[0].name);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-bg-secondary border border-border-glass rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-faint hover:text-text-secondary hover:bg-surface-hover"
          aria-label="Show competitor suggestions"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border-glass bg-bg shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-muted">
              {query.trim()
                ? `Add "${query.trim()}" as a new competitor`
                : "No other notebooks have competitors yet. Type a name to add one."}
            </div>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((suggestion) => (
                <li key={suggestion.name}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => selectSuggestion(suggestion.name)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-hover transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {suggestion.name}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-faint">
                        {suggestion.notebookCount} notebook
                        {suggestion.notebookCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 tabular-nums">
                      {formatCompetitorCurrency(suggestion.totalSalesPotential)} across workspace
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() &&
            !filtered.some(
              (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={() => selectSuggestion(query.trim())}
                className="w-full text-left px-3 py-2.5 border-t border-border-glass text-sm text-neon-purple-tint hover:bg-neon-purple/5"
              >
                Add new: <span className="font-medium">{query.trim()}</span>
              </button>
            )}
        </div>
      )}
    </div>
  );
}