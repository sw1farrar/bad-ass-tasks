import type { FileRecordType, FileReviewStatus, Note } from "@/types";
import { FILE_REVIEW_FILED, FILE_REVIEW_PENDING, inferRecordTypeFromTags } from "@/lib/files/fileTypes";
import { parseFileAiSuggestion } from "@/lib/files/fileAiSuggestion";
import type { Database } from "@/types/supabase";

type NoteRow = Database["public"]["Tables"]["notes"]["Row"];

/** Columns needed for file list, filters, search metadata, and badges — excludes heavy bodies. */
export const NOTE_LIST_SELECT =
  "id,workspace_id,title,created_at,updated_at,tags,linked_task_ids,linked_note_ids,parent_note_id,sort_order,search_plain,email_source,email_pipeline_version,review_status,record_type,memo,filed_at,reviewed_by,search_document,is_archived,ai_suggestion,notebook_id";

export type NoteListRow = Pick<
  NoteRow,
  | "id"
  | "workspace_id"
  | "title"
  | "created_at"
  | "updated_at"
  | "tags"
  | "linked_task_ids"
  | "parent_note_id"
  | "review_status"
  | "record_type"
  | "memo"
  | "filed_at"
  | "reviewed_by"
  | "search_document"
  | "is_archived"
> & {
  notebook_id?: string | null;
  linked_note_ids?: string[] | null;
  sort_order?: number | null;
  search_plain?: string | null;
  email_source?: string | null;
  email_pipeline_version?: number | null;
  ai_suggestion?: unknown;
};

function normalizeReviewStatus(value: unknown): FileReviewStatus {
  return value === FILE_REVIEW_PENDING ? FILE_REVIEW_PENDING : FILE_REVIEW_FILED;
}

function normalizeRecordType(value: unknown, tags: string[]): FileRecordType {
  const allowed = new Set(["note", "email", "document", "receipt", "other"]);
  if (typeof value === "string" && allowed.has(value)) return value as FileRecordType;
  return inferRecordTypeFromTags(tags);
}

/** Map a slim list row into a Note without loading editor/preview bodies. */
export function mapNoteListRow(row: NoteListRow): Note {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
    linkedNoteIds: row.linked_note_ids ?? [],
    parentNoteId: row.parent_note_id ?? null,
    sortOrder: row.sort_order ?? undefined,
    searchPlain: row.search_plain ?? null,
    emailSource: row.email_source ?? null,
    emailPipelineVersion: row.email_pipeline_version ?? null,
    reviewStatus: normalizeReviewStatus(row.review_status),
    recordType: normalizeRecordType(row.record_type, row.tags ?? []),
    memo: row.memo ?? null,
    filedAt: row.filed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    searchDocument: row.search_document ?? null,
    isArchived: row.is_archived ?? false,
    aiSuggestion: parseFileAiSuggestion(row.ai_suggestion),
    notebookId: row.notebook_id ?? null,
    bodyHydrated: false,
  };
}

/** Whether a note has full editor/preview payload loaded (content, rawHtml, snapshots). */
export function isNoteBodyHydrated(note: Note): boolean {
  if (note.bodyHydrated === true) return true;
  const hasContent = typeof note.content === "string" && note.content.length > 0;
  const hasRawHtml = typeof note.rawHtml === "string" && note.rawHtml.length > 0;
  const hasSnapshots = Array.isArray(note.snapshots) && note.snapshots.length > 0;
  if (hasContent || hasRawHtml || hasSnapshots) return true;
  return note.bodyHydrated !== false;
}

/** Merge a fully hydrated note over an existing list projection without dropping list fields. */
export function mergeHydratedNote(existing: Note, hydrated: Note): Note {
  return {
    ...existing,
    ...hydrated,
    tags: hydrated.tags ?? existing.tags,
    linkedTaskIds: hydrated.linkedTaskIds ?? existing.linkedTaskIds,
    linkedNoteIds: hydrated.linkedNoteIds ?? existing.linkedNoteIds,
    bodyHydrated: true,
  };
}

/** Stable local search haystack from list metadata (no body required). */
export function noteListSearchHaystack(note: Note): string {
  return [note.title, note.searchPlain, note.searchDocument, note.memo, ...(note.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}