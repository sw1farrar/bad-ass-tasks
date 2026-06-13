"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ListItemFamilyGroupProps {
  familyId: string;
  solo?: boolean;
  /** Family under the pointer while dragging — shows optimistic drop preview */
  isDropTarget?: boolean;
  children: React.ReactNode;
}

export function ListItemFamilyGroup({
  familyId,
  solo = false,
  isDropTarget = false,
  children,
}: ListItemFamilyGroupProps) {
  return (
    <div
      className={cn(
        "list-item-family",
        solo && "list-item-family--solo",
        isDropTarget && "list-item-family--drop-target",
      )}
      data-list-family={familyId}
    >
      {children}
    </div>
  );
}