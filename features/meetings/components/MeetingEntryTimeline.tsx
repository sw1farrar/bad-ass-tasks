"use client";

import React, { useMemo, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingAgendaEntry, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";
import { sortMeetingEntriesNewestFirst } from "@/lib/meetings/meetingFilters";

interface MeetingEntryTimelineProps {
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  canCompose?: boolean;
  onUpdateEntry?: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteEntry?: (id: string) => void;
}

export function MeetingEntryTimeline({
  entries,
  members,
  currentUserId,
  canCompose = true,
  onUpdateEntry,
  onRequestDeleteEntry,
}: MeetingEntryTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = !!onUpdateEntry;
  const canDelete = !!onRequestDeleteEntry;
  const sortedEntries = useMemo(
    () => sortMeetingEntriesNewestFirst(entries),
    [entries],
  );

  const startEdit = (entry: MeetingAgendaEntry) => {
    setEditingId(entry.id);
    setDraftBody(entry.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftBody("");
  };

  const saveEdit = async (id: string) => {
    const trimmed = draftBody.trim();
    if (!trimmed || !onUpdateEntry) return;
    setIsSaving(true);
    try {
      await onUpdateEntry(id, trimmed);
      cancelEdit();
      toast.success("Note updated");
    } catch {
      toast.error("Could not save note");
    } finally {
      setIsSaving(false);
    }
  };

  if (sortedEntries.length === 0) {
    return (
      <p className="text-sm text-text-muted px-4 py-6 text-center">
        {canCompose
          ? "No notes yet. Add a note below — each entry is timestamped automatically."
          : "No notes for this topic."}
      </p>
    );
  }

  return (
    <div className="meeting-entry-timeline flex flex-col gap-4 px-4 py-3">
      {sortedEntries.map((entry) => {
        const author = entry.authorId
          ? getMemberDisplayName(
              members.find((m) => m.userId === entry.authorId) ?? {
                userId: entry.authorId,
                workspaceId: "",
                role: "member",
                joinedAt: "",
              },
              currentUserId,
            )
          : "Note";
        const isEditing = editingId === entry.id;

        return (
          <div key={entry.id} className="meeting-entry-timeline__item group relative">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="text-xs text-text-faint min-w-0">
                {format(parseISO(entry.createdAt), "MMM d, h:mm a")}
                <span className="mx-1.5">·</span>
                <span className="text-text-muted">{author}</span>
                {entry.isDecision && (
                  <span className="ml-2 text-amber-400/90 font-medium">Decision</span>
                )}
              </div>
              {(canEdit || canDelete) && !isEditing && (
                <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onRequestDeleteEntry(entry.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void saveEdit(entry.id);
                    }
                  }}
                  disabled={isSaving}
                  rows={3}
                  autoFocus
                  className="w-full resize-none bg-bg-secondary border border-neon-purple/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/50 min-h-[72px]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(entry.id)}
                    disabled={isSaving || !draftBody.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neon-purple/30 bg-neon-purple/10 px-2.5 py-1.5 text-xs font-medium text-neon-purple-tint disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-hover"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className={cn("text-sm text-text-primary whitespace-pre-wrap", canEdit && "md:pr-14")}>
                {entry.body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}