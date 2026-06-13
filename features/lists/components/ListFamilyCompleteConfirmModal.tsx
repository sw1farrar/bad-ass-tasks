"use client";

import React from "react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import type { ListItem } from "@/types";

interface ListFamilyCompleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentItem: ListItem;
  itemsToComplete: ListItem[];
  onConfirm: () => void | Promise<void>;
}

function formatItemLabel(item: ListItem): string {
  return item.text.trim() || "Untitled item";
}

export function ListFamilyCompleteConfirmModal({
  open,
  onOpenChange,
  parentItem,
  itemsToComplete,
  onConfirm,
}: ListFamilyCompleteConfirmModalProps) {
  const nestedCount = Math.max(0, itemsToComplete.length - 1);

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Complete this family?"
      highlight={formatItemLabel(parentItem)}
      description={
        nestedCount > 0
          ? `Checking off this item will also complete ${nestedCount} nested item${nestedCount === 1 ? "" : "s"}:`
          : "Checking off this item will complete it."
      }
      confirmText="Complete all"
      cancelText="Cancel"
      onConfirm={onConfirm}
      details={
        itemsToComplete.length > 0 ? (
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border-glass bg-surface-inset/40 px-3 py-2.5">
            {itemsToComplete.map((item) => (
              <li
                key={item.id}
                className="list-family-complete-item text-sm text-text-primary leading-snug"
              >
                {formatItemLabel(item)}
              </li>
            ))}
          </ul>
        ) : null
      }
    />
  );
}