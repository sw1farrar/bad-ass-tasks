"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { getMemberDisplayName } from "@/lib/assignee";
import type { WorkspaceMember } from "@/types";

interface HealthMemberFilterProps {
  members: WorkspaceMember[];
  selectedId: string | "all";
  onChange: (id: string | "all") => void;
  colorMap: Record<string, string>;
}

export function HealthMemberFilter({
  members,
  selectedId,
  onChange,
  colorMap,
}: HealthMemberFilterProps) {
  return (
    <div className="health-member-filter flex flex-wrap md:flex-wrap items-center gap-2 px-3 py-2 max-md:overflow-x-auto max-md:flex-nowrap max-md:snap-x max-md:touch-pan-x">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "health-member-chip rounded-full px-3.5 py-2 min-h-[44px] text-xs font-semibold border transition max-md:shrink-0 max-md:snap-start",
          selectedId === "all"
            ? "bg-neon-purple/15 text-neon-purple-tint border-neon-purple/30"
            : "text-text-secondary border-border-glass hover:bg-surface-hover",
        )}
      >
        All
      </button>
      {members.map((m) => (
        <button
          key={m.userId}
          type="button"
          onClick={() => onChange(m.userId)}
          className={cn(
            "health-member-chip rounded-full px-3.5 py-2 min-h-[44px] text-xs font-semibold border transition inline-flex items-center gap-1.5 max-md:shrink-0 max-md:snap-start",
            selectedId === m.userId
              ? "bg-neon-purple/15 text-neon-purple-tint border-neon-purple/30"
              : "text-text-secondary border-border-glass hover:bg-surface-hover",
          )}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: colorMap[m.userId] ?? "var(--neon-purple)" }}
            aria-hidden
          />
          {getMemberDisplayName(m)}
        </button>
      ))}
    </div>
  );
}