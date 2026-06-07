"use client";

import { getAssigneeFirstName } from "@/lib/assignee";
import { cn } from "@/lib/utils";

interface TaskAssigneeBadgeProps {
  label?: string | null;
  className?: string;
  compact?: boolean;
}

export function TaskAssigneeBadge({ label, className, compact = false }: TaskAssigneeBadgeProps) {
  if (!label) return null;

  const initial = label === "You" ? "Y" : label.charAt(0).toUpperCase();
  const displayLabel = compact ? getAssigneeFirstName(label) : label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] text-[#a1a1aa] shrink-0",
        compact ? "px-1.5 py-0.5 text-[10px] min-w-0" : "px-2 py-0.5 text-xs",
        className
      )}
      title={`Assigned to ${label}`}
    >
      {!compact && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-[#c084fc]/15 text-[#c084fc] font-medium h-5 w-5 text-[10px]"
        >
          {initial}
        </span>
      )}
      <span
        className={cn(
          "truncate min-w-0",
          compact ? "max-w-[10rem]" : "max-w-[7rem]",
        )}
      >
        {displayLabel}
      </span>
    </span>
  );
}