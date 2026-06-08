"use client";

import React from "react";
import { Check, CornerDownRight, CornerLeftUp, GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { ListItem } from "@/types";

const INDENT_STEP_REM = 1.25;

interface ListItemRowProps {
  item: ListItem;
  depth?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndent?: (id: string) => void;
  onOutdent?: (id: string) => void;
  readOnly?: boolean;
  sortable?: boolean;
  insertBelowOnEnter?: boolean;
  onInsertBelow?: (id: string) => void;
  registerInputRef?: (el: HTMLInputElement | null) => void;
}

export function ListItemRow({
  item,
  depth = 0,
  onToggle,
  onDelete,
  onTextChange,
  onIndent,
  onOutdent,
  readOnly = false,
  sortable = true,
  insertBelowOnEnter = false,
  onInsertBelow,
  registerInputRef,
}: ListItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable || readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    paddingLeft: depth > 0 ? `${depth * INDENT_STEP_REM}rem` : undefined,
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const cursorAtEnd =
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;
      if (insertBelowOnEnter && cursorAtEnd && onInsertBelow) {
        onInsertBelow(item.id);
        return;
      }
      input.blur();
      return;
    }
    if (e.key === "Tab" && !readOnly) {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent?.(item.id);
      } else {
        onIndent?.(item.id);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("list-item-row group", isDragging && sortable && "is-dragging-source")}
      data-no-open={readOnly ? undefined : true}
    >
      {sortable && !readOnly && (
        <button
          type="button"
          className="list-item-drag shrink-0 text-[#52525b] opacity-40 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn("list-item-check", item.completed && "is-done")}
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        data-no-open
      >
        {item.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
      </button>
      {readOnly ? (
        <span
          className={cn(
            "list-item-text bg-transparent outline-none border-none w-full",
            item.completed && "is-done",
          )}
        >
          {item.text}
        </span>
      ) : (
        <input
          ref={registerInputRef}
          value={item.text}
          onChange={(e) => onTextChange(item.id, e.target.value)}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (!trimmed) onDelete(item.id);
            else if (trimmed !== item.text) onTextChange(item.id, trimmed);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "list-item-text bg-transparent outline-none border-none w-full",
            item.completed && "is-done",
          )}
          aria-label="List item"
        />
      )}
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => onOutdent?.(item.id)}
            className={cn(
              "list-item-indent-btn shrink-0 text-[#52525b] hover:text-[#c084fc] transition",
              "opacity-50 md:opacity-0 md:group-hover:opacity-100",
            )}
            aria-label="Outdent item"
            title="Outdent (Shift+Tab)"
          >
            <CornerLeftUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onIndent?.(item.id)}
            className={cn(
              "list-item-indent-btn shrink-0 text-[#52525b] hover:text-[#c084fc] transition",
              "opacity-50 md:opacity-0 md:group-hover:opacity-100",
            )}
            aria-label="Indent item"
            title="Indent (Tab)"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="list-item-delete shrink-0 opacity-50 md:opacity-0 md:group-hover:opacity-100 text-[#52525b] hover:text-[#ff3366] transition"
            aria-label="Remove item"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}