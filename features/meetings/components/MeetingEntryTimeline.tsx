"use client";

import React, { useMemo, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { formatAgendaEntryTimestamp } from "@/lib/meetings/agendaEntryLabels";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MeetingAgendaEntry, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";
import { sortMeetingEntriesNewestFirst } from "@/lib/meetings/meetingFilters";
import {
  EMPTY_AGENDA_DOC,
  isEmptyAgendaEntryBody,
} from "@/lib/meetings/agendaEntryBody";
import { MeetingEntryBodyView, MeetingEntryRichEditor } from "./MeetingEntryRichEditor";

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
  const [draftBody, setDraftBody] = useState(EMPTY_AGENDA_DOC);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = !!onUpdateEntry;
  const canDelete = !!onRequestDeleteEntry;
  const sortedEntries = useMemo(
    () => sortMeetingEntriesNewestFirst(entries),
    [entries],
  );

  const startEdit = (entry: MeetingAgendaEntry) => {
    setEditingId(entry.id);
    setDraftBody(entry.body || EMPTY_AGENDA_DOC);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftBody(EMPTY_AGENDA_DOC);
  };

  const saveEdit = async (id: string) => {
    if (isEmptyAgendaEntryBody(draftBody) || !onUpdateEntry) return;
    setIsSaving(true);
    try {
      await onUpdateEntry(id, draftBody);
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
          ? "No notes yet. Add a note below — each entry is dated automatically."
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
                {formatAgendaEntryTimestamp(entry.createdAt)}
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
              <div
                className="space-y-2"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
              >
                <MeetingEntryRichEditor
                  content={draftBody}
                  onChange={setDraftBody}
                  disabled={isSaving}
                  editorKey={`edit-${entry.id}`}
                  className="rounded-xl border border-neon-purple/30 overflow-hidden"
                  minHeight="140px"
                  onModEnter={() => void saveEdit(entry.id)}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(entry.id)}
                    disabled={isSaving || isEmptyAgendaEntryBody(draftBody)}
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
                  <span className="text-[11px] text-text-faint ml-auto">Ctrl+Enter to save</span>
                </div>
              </div>
            ) : (
              <div className={cn(canEdit && "md:pr-14")}>
                <MeetingEntryBodyView body={entry.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
