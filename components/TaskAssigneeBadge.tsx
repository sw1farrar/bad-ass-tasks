"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskAssigneeBadgeProps {
  label?: string | null;
  className?: string;
  compact?: boolean;
}

export function TaskAssigneeBadge({ label, className, compact = false }: TaskAssigneeBadgeProps) {
  if (!label) return null;

  const initial = label === "You" ? "Y" : label.charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] text-[#a1a1aa] shrink-0",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
      title={`Assigned to ${label}`}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-[#c084fc]/15 text-[#c084fc] font-medium",
          compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]"
        )}
      >
        {initial}
      </span>
      {!compact && <span className="truncate max-w-[7rem]">{label}</span>}
      {compact && <User className="h-2.5 w-2.5 opacity-70" aria-hidden />}
    </span>
  );
}