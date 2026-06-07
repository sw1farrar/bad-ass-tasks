import type { Note } from "@/types";

/** Normalize notes.content from a Supabase realtime payload row. */
export function contentFromNoteRow(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"')) {
      return trimmed;
    }
    return trimmed;
  }
  if (raw && typeof raw === "object" && (raw as { type?: string }).type === "doc") {
    return JSON.stringify(raw);
  }
  return "";
}

export function mapRealtimeNoteRow(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title ?? ""),
    content: contentFromNoteRow(row.content),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedNoteIds: Array.isArray(row.linked_note_ids) ? (row.linked_note_ids as string[]) : [],
    parentNoteId: (row.parent_note_id as string | null | undefined) ?? null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : undefined,
  };
}

export function mergeRealtimeNoteUpdate(existing: Note, row: Record<string, unknown>): Note {
  const next: Note = { ...existing };

  if (row.title !== undefined) next.title = String(row.title ?? "");
  if (row.updated_at !== undefined) next.updatedAt = String(row.updated_at);
  if (row.tags !== undefined) {
    next.tags = Array.isArray(row.tags) ? (row.tags as string[]) : next.tags;
  }
  if (Object.prototype.hasOwnProperty.call(row, "parent_note_id")) {
    next.parentNoteId = (row.parent_note_id as string | null | undefined) ?? null;
  }
  if (row.content !== undefined && row.content !== null) {
    next.content = contentFromNoteRow(row.content);
  }
  if (row.linked_task_ids !== undefined) {
    next.linkedTaskIds = Array.isArray(row.linked_task_ids)
      ? (row.linked_task_ids as string[])
      : next.linkedTaskIds;
  }
  if (row.linked_note_ids !== undefined) {
    next.linkedNoteIds = Array.isArray(row.linked_note_ids)
      ? (row.linked_note_ids as string[])
      : next.linkedNoteIds;
  }
  if (row.sort_order !== undefined) {
    next.sortOrder = typeof row.sort_order === "number" ? row.sort_order : next.sortOrder;
  }

  return next;
}