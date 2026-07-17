"use client";

import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskNotesIndicatorProps {
  className?: string;
}

export function TaskNotesIndicator({ className }: TaskNotesIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 text-text-muted",
        className,
      )}
      title="Has notes"
      aria-label="Has notes"
    >
      <StickyNote className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

export function taskHasNotes(description: string | null | undefined): boolean {
  return Boolean(description?.trim());
}
