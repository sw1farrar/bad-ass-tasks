"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItemStatus, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";

interface MeetingAgendaRailProps {
  items: MeetingAgendaItem[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedId: string | null;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onAdd: (title?: string) => void;
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

export function MeetingAgendaRail({
  items,
  members,
  currentUserId,
  selectedId,
  readOnly,
  onSelect,
  onAdd,
  onReorder,
}: MeetingAgendaRailProps) {
  const [newTitle, setNewTitle] = useState("");

  const move = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const ordered = items.map((i) => i.id);
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    onReorder(ordered);
  };

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(title);
    setNewTitle("");
  };

  return (
    <aside className="meetings-agenda-rail flex flex-col min-h-0">
      <div className="px-3 py-3 border-b border-border-glass space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-faint">Agenda</span>
        {!readOnly && (
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Quick add topic…"
              className="flex-1 min-w-0 bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="shrink-0 flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[40px] min-w-[40px] text-neon-purple-tint disabled:opacity-40"
              aria-label="Add topic"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-[11px] leading-snug text-text-muted">
          Assign someone responsible on each topic to track who owns follow-ups after the meeting.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-text-muted px-2 py-4 text-center">Add your first topic</p>
        ) : (
          items.map((item, index) => {
            const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
            const isSelected = item.id === selectedId;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-1 px-2 py-2 rounded-lg cursor-pointer transition",
                  isSelected && "bg-neon-purple/12 border border-neon-purple/25",
                  !isSelected && "hover:bg-surface-hover border border-transparent",
                )}
                onClick={() => onSelect(item.id)}
              >
                <span className="text-xs font-semibold text-text-faint w-5 shrink-0 text-center pt-0.5">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm truncate text-text-primary", statusClass(item.status))}>
                    {item.title}
                  </div>
                  {owner ? (
                    <div className="text-[11px] text-text-muted truncate mt-0.5">{owner}</div>
                  ) : null}
                </div>
                {!readOnly && (
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, "up");
                      }}
                      disabled={index === 0}
                      className="p-1 rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-30"
                      aria-label="Move topic up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(index, "down");
                      }}
                      disabled={index === items.length - 1}
                      className="p-1 rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-30"
                      aria-label="Move topic down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}