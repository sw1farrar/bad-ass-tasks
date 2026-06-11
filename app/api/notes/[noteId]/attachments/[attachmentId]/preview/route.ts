import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchNoteAttachmentBuffer } from "@/lib/notes/fetchNoteAttachmentBuffer";
import { extractLegacyWordDoc } from "@/lib/preview/extractLegacyWordDoc";
import { isWordFile } from "@/lib/preview/officeMime";

type RouteContext = { params: Promise<{ noteId: string; attachmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { noteId, attachmentId } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { buffer, fileName, mimeType } = await fetchNoteAttachmentBuffer(
      noteId,
      attachmentId,
      user.id,
    );

    if (!isWordFile(mimeType, fileName)) {
      return NextResponse.json({ error: "not_word_document" }, { status: 400 });
    }

    const extracted = await extractLegacyWordDoc(buffer);
    const body = extracted.body.trim();
    const footnotes = extracted.footnotes.trim();
    const endnotes = extracted.endnotes.trim();

    if (!body && !footnotes && !endnotes) {
      return NextResponse.json({ error: "empty_document" }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      format: "word-text",
      body: extracted.body,
      footnotes: extracted.footnotes,
      endnotes: extracted.endnotes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "preview_failed";
    const status =
      message === "not_a_member"
        ? 403
        : message === "note_not_found" || message === "attachment_not_found"
          ? 404
          : message === "file_not_configured"
            ? 503
            : message === "Unable to read this type of file"
              ? 415
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}