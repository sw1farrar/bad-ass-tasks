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

type AttachmentSearchRow = {
  file_name: string;
  extracted_text?: string | null;
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

async function loadAttachmentSearchParts(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  noteId: string,
): Promise<{ fileNames: string[]; extractedTexts: string[] }> {
  const fullSelect = await (supabase.from("note_attachments") as any)
    .select("file_name, extracted_text")
    .eq("note_id", noteId);

  if (fullSelect.error?.code === "42703") {
    const legacySelect = await (supabase.from("note_attachments") as any)
      .select("file_name")
      .eq("note_id", noteId);
    if (legacySelect.error?.code === "42P01" || legacySelect.error) {
      return { fileNames: [], extractedTexts: [] };
    }
    const rows = (legacySelect.data ?? []) as Array<{ file_name: string }>;
    return { fileNames: rows.map((a) => a.file_name), extractedTexts: [] };
  }

  if (fullSelect.error?.code === "42P01") {
    return { fileNames: [], extractedTexts: [] };
  }
  if (fullSelect.error) {
    return { fileNames: [], extractedTexts: [] };
  }

  const rows = (fullSelect.data ?? []) as AttachmentSearchRow[];
  return {
    fileNames: rows.map((a) => a.file_name),
    extractedTexts: rows
      .map((a) => a.extracted_text?.trim())
      .filter((t): t is string => !!t),
  };
}

/** Rebuild notes.search_document from note fields + attachment metadata/text. */
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
  const { fileNames, extractedTexts } = await loadAttachmentSearchParts(supabase, noteId);
  const searchPlain = row.search_plain?.trim() || contentToSearchPlain(row.content);
  const searchDocument = buildSearchDocument({
    title: row.title ?? undefined,
    searchPlain,
    tags: row.tags ?? [],
    memo: row.memo,
    attachmentFileNames: fileNames,
    attachmentExtractedTexts: extractedTexts,
  });

  const { error: updateError } = await (supabase.from("notes") as any)
    .update({ search_document: searchDocument || null })
    .eq("id", noteId);

  if (updateError?.code === "42703") return;
}

/** Persist PDF/plain extraction on an attachment row (column optional). */
export async function saveAttachmentExtractedText(
  attachmentId: string,
  extractedText: string,
): Promise<void> {
  if (!extractedText.trim()) return;
  const supabase = createAdminSupabaseClient();
  const { error } = await (supabase.from("note_attachments") as any)
    .update({ extracted_text: extractedText.slice(0, 120_000) })
    .eq("id", attachmentId);
  if (error?.code === "42703") return;
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

