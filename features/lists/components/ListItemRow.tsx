"use client";

import React from "react";
import { Check, GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { ListItem } from "@/types";

interface ListItemRowProps {
  item: ListItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  sortable?: boolean;
}

export function ListItemRow({
  item,
  onToggle,
  onDelete,
  onTextChange,
  sortable = true,
}: ListItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="list-item-row group">
      {sortable && (
        <button
          type="button"
          className="list-item-drag shrink-0 text-[#52525b] opacity-40 md:opacity-0 md:group-hover:opacity-100 cursor-grab active:cursor-grabbing"
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
      >
        {item.completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
      </button>
      <input
        value={item.text}
        onChange={(e) => onTextChange(item.id, e.target.value)}
        onBlur={(e) => {
          const trimmed = e.target.value.trim();
          if (!trimmed) onDelete(item.id);
          else if (trimmed !== item.text) onTextChange(item.id, trimmed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "list-item-text bg-transparent outline-none border-none w-full",
          item.completed && "is-done"
        )}
        aria-label="List item"
      />
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="list-item-delete shrink-0 opacity-50 md:opacity-0 md:group-hover:opacity-100 text-[#52525b] hover:text-[#ff3366] transition"
        aria-label="Remove item"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}