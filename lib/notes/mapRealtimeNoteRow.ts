import type { FileRecordType, FileReviewStatus, Note } from "@/types";
import { inferRecordTypeFromTags } from "@/lib/files/fileTypes";

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
  const content = contentFromNoteRow(row.content);
  const rawHtml = typeof row.raw_html === "string" ? row.raw_html : null;
  const hasBody =
    content.length > 0 ||
    (typeof rawHtml === "string" && rawHtml.length > 0) ||
    (Array.isArray(row.snapshots) && row.snapshots.length > 0);

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title ?? ""),
    content,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedNoteIds: Array.isArray(row.linked_note_ids) ? (row.linked_note_ids as string[]) : [],
    parentNoteId: (row.parent_note_id as string | null | undefined) ?? null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : undefined,
    reviewStatus:
      row.review_status === "pending_review"
        ? ("pending_review" as FileReviewStatus)
        : ("filed" as FileReviewStatus),
    recordType:
      (typeof row.record_type === "string"
        ? row.record_type
        : inferRecordTypeFromTags(
            Array.isArray(row.tags) ? (row.tags as string[]) : [],
          )) as FileRecordType,
    memo: typeof row.memo === "string" ? row.memo : null,
    filedAt: typeof row.filed_at === "string" ? row.filed_at : null,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    searchDocument: typeof row.search_document === "string" ? row.search_document : null,
    searchPlain: typeof row.search_plain === "string" ? row.search_plain : null,
    rawHtml,
    snapshots: Array.isArray(row.snapshots) ? (row.snapshots as Note["snapshots"]) : [],
    bodyHydrated: hasBody,
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
    next.bodyHydrated = true;
  }
  if (row.raw_html !== undefined) {
    next.rawHtml = typeof row.raw_html === "string" ? row.raw_html : null;
    if (next.rawHtml) next.bodyHydrated = true;
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
  if (row.review_status !== undefined) {
    next.reviewStatus = row.review_status === "pending_review" ? "pending_review" : "filed";
  }
  if (row.record_type !== undefined && typeof row.record_type === "string") {
    next.recordType = row.record_type as FileRecordType;
  }
  if (row.memo !== undefined) {
    next.memo = typeof row.memo === "string" ? row.memo : null;
  }
  if (row.filed_at !== undefined) {
    next.filedAt = typeof row.filed_at === "string" ? row.filed_at : null;
  }
  if (row.search_document !== undefined) {
    next.searchDocument = typeof row.search_document === "string" ? row.search_document : null;
  }
  if (row.search_plain !== undefined) {
    next.searchPlain = typeof row.search_plain === "string" ? row.search_plain : null;
  }

  return next;
}