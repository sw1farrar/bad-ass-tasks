import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildSearchDocument } from "@/lib/files/buildSearchDocument";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import {
  inferRecordTypeFromMime,
  type FileRecordType,
} from "@/lib/files/fileTypes";

type NoteSearchRow = {
  title: string | null;
  content: unknown;
  search_plain: string | null;
  tags: string[] | null;
  memo: string | null;
  record_type: string | null;
  review_status: string | null;
};

function contentToSearchPlain(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        return extractNoteSearchText(JSON.parse(trimmed));
      } catch {
        return trimmed.replace(/\s+/g, " ").trim();
      }
    }
    return trimmed.replace(/\s+/g, " ").trim();
  }
  if (typeof content === "object") {
    try {
      return extractNoteSearchText(content);
    } catch {
      return "";
    }
  }
  return "";
}

/** Rebuild notes.search_document from note fields + attachment filenames. */
export async function refreshNoteSearchDocument(noteId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("title, content, search_plain, tags, memo, record_type, review_status")
    .eq("id", noteId)
    .maybeSingle();

  if (noteError?.code === "42703") return;
  if (noteError || !note) return;

  const row = note as NoteSearchRow;
  const { data: attachments, error: attachError } = await (supabase.from("note_attachments") as any)
    .select("file_name")
    .eq("note_id", noteId);

  if (attachError?.code === "42P01") {
    // Attachments table missing — still update search_document from note fields only.
  } else if (attachError) {
    return;
  }

  const attachmentFileNames = ((attachments ?? []) as Array<{ file_name: string }>).map(
    (a) => a.file_name,
  );
  const searchPlain = row.search_plain?.trim() || contentToSearchPlain(row.content);
  const searchDocument = buildSearchDocument({
    title: row.title ?? undefined,
    searchPlain,
    tags: row.tags ?? [],
    memo: row.memo,
    attachmentFileNames,
  });

  const { error: updateError } = await (supabase.from("notes") as any)
    .update({ search_document: searchDocument || null })
    .eq("id", noteId);

  if (updateError?.code === "42703") return;
}

/** After an upload, classify pending_review intake as a document when appropriate. */
export async function maybePromoteNoteToDocumentRecord(
  noteId: string,
  mimeType: string,
): Promise<FileRecordType | null> {
  const supabase = createAdminSupabaseClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("record_type, review_status, tags")
    .eq("id", noteId)
    .maybeSingle();

  if (error?.code === "42703" || error || !note) return null;

  const row = note as {
    record_type: string | null;
    review_status: string | null;
    tags: string[] | null;
  };

  if (row.review_status !== "pending_review") return null;
  if (row.record_type === "email" || (row.tags ?? []).includes("from-email")) return null;
  if (row.record_type && row.record_type !== "note") return null;

  const nextType = inferRecordTypeFromMime(mimeType);
  const { error: updateError } = await (supabase.from("notes") as any)
    .update({ record_type: nextType })
    .eq("id", noteId);

  if (updateError?.code === "42703") return null;
  return nextType;
}