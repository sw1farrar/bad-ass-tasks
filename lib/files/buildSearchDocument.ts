import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import type { Note } from "@/types";

function contentToSearchPlain(content: string | undefined): string {
  if (!content?.trim()) return "";
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

/** Build unified search_document text for FTS and client fallback. */
export function buildSearchDocument(input: {
  title?: string;
  content?: string;
  searchPlain?: string | null;
  tags?: string[];
  memo?: string | null;
  attachmentFileNames?: string[];
}): string {
  const body =
    input.searchPlain?.trim() ||
    contentToSearchPlain(input.content) ||
    "";
  const parts = [
    input.title?.trim() ?? "",
    body,
    input.memo?.trim() ?? "",
    ...(input.tags ?? []),
    ...(input.attachmentFileNames ?? []),
  ].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function buildSearchDocumentFromNote(
  note: Pick<Note, "title" | "content" | "searchPlain" | "tags" | "memo">,
  attachmentFileNames: string[] = [],
): string {
  return buildSearchDocument({
    title: note.title,
    content: note.content,
    searchPlain: note.searchPlain,
    tags: note.tags,
    memo: note.memo,
    attachmentFileNames,
  });
}