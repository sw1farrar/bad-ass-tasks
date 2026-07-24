"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeAttendeeNames } from "@/lib/meetings/attendees";

interface MeetingAttendeeEditorProps {
  value: string[];
  suggestions: string[];
  disabled?: boolean;
  onChange: (attendees: string[]) => void;
}

export function MeetingAttendeeEditor({
  value,
  suggestions,
  disabled,
  onChange,
}: MeetingAttendeeEditorProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const taken = new Set(value.map((n) => n.toLowerCase()));
    return suggestions
      .filter((name) => !taken.has(name.toLowerCase()))
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commitName = (raw: string) => {
    const [name] = normalizeAttendeeNames([raw]);
    if (!name) return;
    if (value.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      setOpen(false);
      return;
    }
    onChange([...value, name]);
    setDraft("");
    setOpen(false);
  };

  const removeName = (name: string) => {
    const key = name.toLowerCase();
    onChange(value.filter((n) => n.toLowerCase() !== key));
  };

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-lg border border-border-glass bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary"
          >
            {name}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeName(name)}
                className="rounded p-0.5 text-text-faint hover:text-text-primary"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitName(draft);
              } else if (e.key === "Backspace" && !draft && value.length > 0) {
                removeName(value[value.length - 1]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            onBlur={() => {
              if (draft.trim()) commitName(draft);
            }}
            placeholder={value.length ? "Add attendee…" : "Attendees…"}
            className="min-w-[8rem] flex-1 bg-transparent text-xs text-text-secondary placeholder:text-text-faint focus:outline-none py-0.5"
            aria-label="Add attendee"
          />
        )}
        {disabled && value.length === 0 && (
          <span className="text-xs text-text-faint">No attendees</span>
        )}
      </div>

      {open && !disabled && filteredSuggestions.length > 0 && (
        <ul
          className={cn(
            "absolute z-20 left-0 right-0 top-full mt-1 max-h-40 overflow-auto rounded-xl border border-border-glass",
            "bg-bg-panel shadow-lg py-1",
          )}
          role="listbox"
        >
          {filteredSuggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitName(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
