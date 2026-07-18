"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
  dense = false,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Tighter header + wider badge for schedule sidebars */
  dense?: boolean;
}) {
  // Initial open only — don't force-close when parent re-renders after the user expands.
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border-glass overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm text-text-secondary hover:bg-surface-hover active:bg-bg-tertiary transition",
          dense ? "px-2.5 py-2 min-h-[40px]" : "px-3 py-2.5 min-h-[44px]",
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="font-medium shrink-0 whitespace-nowrap">{title}</span>
          {badge && (
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted truncate min-w-0",
                dense ? "max-w-none flex-1" : "max-w-[140px]",
              )}
              title={badge}
            >
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          className={cn(
            "border-t border-border-glass",
            dense ? "px-2.5 pb-2.5 pt-1" : "px-3 pb-3 pt-1",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
