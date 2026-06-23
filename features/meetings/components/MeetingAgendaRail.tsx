"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItemStatus, MeetingAgendaItem } from "@/types";

interface MeetingAgendaRailProps {
  items: MeetingAgendaItem[];
  selectedId: string | null;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onReorder: (orderedIds: string[]) => void;
}

function statusClass(status: AgendaItemStatus): string {
  switch (status) {
    case "completed":
      return "opacity-60 line-through";
    case "continued":
      return "text-amber-400/90";
    case "in_progress":
      return "text-neon-purple-tint";
    default:
      return "";
  }
}

function SortableItem({
  item,
  isSelected,
  readOnly,
  onSelect,
}: {
  item: MeetingAgendaItem;
  isSelected: boolean;
  readOnly?: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition",
        isSelected && "bg-neon-purple/12 border border-neon-purple/25",
        !isSelected && "hover:bg-surface-hover border border-transparent",
        isDragging && "opacity-70",
      )}
      onClick={() => onSelect(item.id)}
    >
      {!readOnly && (
        <button
          type="button"
          className="p-1 text-text-faint hover:text-text-muted cursor-grab"
          aria-label="Reorder"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <span className={cn("flex-1 text-sm truncate text-text-primary", statusClass(item.status))}>
        {item.title}
      </span>
    </div>
  );
}

export function MeetingAgendaRail({
  items,
  selectedId,
  readOnly,
  onSelect,
  onAdd,
  onReorder,
}: MeetingAgendaRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((i) => i.id));
  };

  return (
    <aside className="meetings-agenda-rail flex flex-col min-h-0">
      <div className="px-3 py-3 border-b border-border-glass flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-faint">Agenda</span>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1.5 rounded-lg text-neon-purple-tint hover:bg-neon-purple/10"
            aria-label="Add topic"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-text-muted px-2 py-4 text-center">Add your first topic</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  readOnly={readOnly}
                  onSelect={onSelect}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </aside>
  );
}