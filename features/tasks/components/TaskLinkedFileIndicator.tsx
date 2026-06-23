"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskLinkedFileIndicatorProps {
  count?: number;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export function TaskLinkedFileIndicator({
  count = 1,
  className,
  onClick,
  disabled = false,
}: TaskLinkedFileIndicatorProps) {
  if (count <= 0) return null;

  const label =
    count === 1
      ? "View linked file or note"
      : `View ${count} linked files or notes`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        "task-linked-file-btn inline-flex items-center gap-0.5 shrink-0 rounded-md border border-neon-purple/25 bg-neon-purple/8 px-1 py-0.5 text-neon-purple-tint transition",
        onClick && !disabled && "hover:border-neon-purple/45 hover:bg-neon-purple/14 active:scale-[0.98]",
        disabled && "opacity-50 cursor-default",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <FileText className="h-3 w-3 shrink-0" aria-hidden />
      {count > 1 ? (
        <span className="text-[10px] font-semibold tabular-nums leading-none">{count}</span>
      ) : null}
    </button>
  );
}