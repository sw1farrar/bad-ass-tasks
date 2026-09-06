"use client";

import { cn } from "@/lib/utils";

export function RemainingReviewMark({
  remaining,
  total,
  size = 44,
}: {
  remaining: number;
  total: number;
  size?: number;
}) {
  const safeTotal = Math.max(total, remaining, 1);
  const done = Math.max(0, safeTotal - remaining);
  const r = 16;
  const c = 2 * Math.PI * r;
  const progress = Math.min(1, done / safeTotal);
  return (
    <div
      className="import-review-mark relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-border-glass"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          className="text-neon-purple"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-neon-purple",
          remaining >= 100 ? "text-[10px]" : "text-xs",
        )}
      >
        {remaining.toLocaleString()}
      </span>
    </div>
  );
}
