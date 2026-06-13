"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SheetDragHandleProps {
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
  /** Show a down chevron under the grab pill (pull-to-dismiss affordance). */
  showChevron?: boolean;
}

export function SheetDragHandle({
  onPointerDown,
  className,
  showChevron = false,
}: SheetDragHandleProps) {
  const interactive = Boolean(onPointerDown);

  return (
    <div
      className={cn(
        "sheet-drag-handle-zone shrink-0",
        interactive && "touch-none cursor-grab active:cursor-grabbing",
        showChevron && "sheet-drag-handle-zone--with-chevron",
        className,
      )}
      onPointerDown={onPointerDown}
      {...(interactive
        ? { role: "button", "aria-label": "Drag down to close" }
        : { "aria-hidden": true })}
    >
      <div className="sheet-drag-handle-affordance flex flex-col items-center gap-0.5">
        <span className="sheet-drag-handle" aria-hidden="true" />
        {showChevron && interactive && (
          <ChevronDown className="sheet-drag-handle-chevron h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        )}
      </div>
    </div>
  );
}