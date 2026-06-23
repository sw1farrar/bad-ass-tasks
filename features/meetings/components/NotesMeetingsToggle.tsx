"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { NotesPageMode } from "@/types";

interface NotesMeetingsToggleProps {
  mode: NotesPageMode;
  onModeChange: (mode: NotesPageMode) => void;
}

const MODES: Array<{ id: NotesPageMode; label: string }> = [
  { id: "notes", label: "Notes" },
  { id: "meetings", label: "Meetings" },
];

export function NotesMeetingsToggle({ mode, onModeChange }: NotesMeetingsToggleProps) {
  return (
    <div
      className="notes-meetings-toggle flex p-1 rounded-xl bg-bg-secondary border border-border-glass gap-1"
      role="tablist"
      aria-label="Notes or meetings"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onModeChange(m.id)}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition",
            mode === m.id
              ? "bg-neon-purple/12 text-neon-purple-tint border border-neon-purple/25 shadow-sm"
              : "text-text-secondary hover:text-text-primary border border-transparent",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}