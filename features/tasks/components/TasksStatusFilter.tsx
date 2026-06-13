"use client";

import { cn } from "@/lib/utils";

export type TasksStatusFilterMode = "all" | "incomplete" | "completed";

const MODES: TasksStatusFilterMode[] = ["all", "incomplete", "completed"];

const LABELS: Record<TasksStatusFilterMode, string> = {
  all: "All",
  incomplete: "Incomplete",
  completed: "Complete",
};

interface TasksStatusFilterProps {
  value: TasksStatusFilterMode;
  onChange: (mode: TasksStatusFilterMode) => void;
  className?: string;
  trackClassName?: string;
}

export function TasksStatusFilter({
  value,
  onChange,
  className,
  trackClassName,
}: TasksStatusFilterProps) {
  return (
    <div
      className={cn(
        "task-recurring-filters w-full max-md:w-full md:w-auto md:shrink-0 overflow-x-auto md:overflow-visible pb-1 md:pb-0",
        className,
      )}
    >
      <div
        className={cn(
          "task-recurring-filters__track flex w-full md:w-auto items-center gap-0.5 p-1 md:p-0.5 rounded-full border border-border-glass bg-surface-hover",
          trackClassName,
        )}
        role="group"
        aria-label="Filter tasks by status"
      >
        {MODES.map((mode) => {
          const isActive = value === mode;
          return (
            <button
              key={`task-status-filter-${mode}`}
              type="button"
              onClick={() => onChange(mode)}
              aria-pressed={isActive}
              className={cn(
                "task-recurring-filter-pill inline-flex items-center justify-center rounded-full text-xs font-semibold whitespace-nowrap transition-all",
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