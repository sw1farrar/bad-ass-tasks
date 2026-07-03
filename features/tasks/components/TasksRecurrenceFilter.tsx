"use client";

import { cn } from "@/lib/utils";

export type TasksRecurrenceFilterMode = "all" | "only" | "none";

const MODES: TasksRecurrenceFilterMode[] = ["all", "only", "none"];

const LABELS: Record<TasksRecurrenceFilterMode, string> = {
  all: "All types",
  only: "Recurring",
  none: "One-time",
};

interface TasksRecurrenceFilterProps {
  value: TasksRecurrenceFilterMode;
  onChange: (mode: TasksRecurrenceFilterMode) => void;
  className?: string;
}

export function TasksRecurrenceFilter({ value, onChange, className }: TasksRecurrenceFilterProps) {
  return (
    <div
      className={cn(
        "task-recurrence-type-filters w-full max-md:w-full md:w-auto md:shrink-0 overflow-x-auto md:overflow-visible pb-1 md:pb-0",
        className,
      )}
    >
      <div
        className="task-recurrence-type-filters__track flex w-full md:w-auto items-center gap-0.5 p-1 md:p-0.5 rounded-full border border-border-glass bg-surface-hover"
        role="group"
        aria-label="Filter tasks by recurrence"
      >
        {MODES.map((mode) => {
          const isActive = value === mode;
          return (
            <button
              key={`task-recurrence-filter-${mode}`}
              type="button"
              onClick={() => onChange(mode)}
              aria-pressed={isActive}
              className={cn(
                "task-recurrence-filter-pill inline-flex items-center justify-center rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                isActive
                  ? "is-active bg-neon-purple text-accent-on shadow-[0_0_12px_rgba(192,132,252,0.28)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
              )}
            >
              {LABELS[mode]}
            </button>
          );
        })}
      </div>
    </div>
  );
}