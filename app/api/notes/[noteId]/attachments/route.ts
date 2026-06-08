import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { uploadNoteAttachment } from "@/lib/storage/noteAttachments";
import { buildNoteAttachmentFileUrl } from "@/lib/notes/attachmentUrls";
import {
  maybePromoteNoteToDocumentRecord,
  refreshNoteSearchDocument,
} from "@/lib/notes/refreshNoteSearchDocument";
import { parsePdfAnnotations } from "@/lib/pdf/annotations";

type RouteContext = { params: Promise<{ noteId: string }> };

async function assertNoteAccess(noteId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("id, workspace_id")
    .eq("id", noteId)
    .maybeSingle();

  if (error || !note) throw new Error("note_not_found");

  const workspaceId = (note as { workspace_id: string }).workspace_id;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");

  return { workspaceId, noteId };
}

export async function GET(_request: Request, context: RouteContext) {
  const { noteId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertNoteAccess(noteId, user.id);

    let rows: unknown[] | null = null;
    let error: { code?: string; message?: string } | null = null;

    const fullSelect = await (supabase.from("note_attachments") as any)
      .select(
        "id, note_id, workspace_id, file_name, mime_type, size_bytes, storage_path, source, created_at, pdf_annotations",
      )
      .eq("note_id", noteId)
      .order("created_at", { ascending: false });

    if (fullSelect.error?.code === "42703") {
      const legacySelect = await (supabase.from("note_attachments") as any)
        .select(
          "id, note_id, workspace_id, file_name, mime_type, size_bytes, storage_path, source, created_at",
        )
        .eq("note_id", noteId)
        .order("created_at", { ascending: false });
      rows = legacySelect.data;
      error = legacySelect.error;
    } else {
      rows = fullSelect.data;
      error = fullSelect.error;
    }

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ ok: true, attachments: [] });
      }
      return NextResponse.json({ error: "attachment_list_failed" }, { status: 500 });
    }

    type AttachmentRow = {
      id: string;
      note_id: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
      storage_path: string;
      source: string;
      created_at: string;
      pdf_annotations?: unknown;
    };

    const attachments = ((rows ?? []) as AttachmentRow[]).map((row) => ({
      id: row.id,
      noteId: row.note_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      source: row.source,
      createdAt: row.created_at,
      previewUrl: buildNoteAttachmentFileUrl(noteId, row.id),
      pdfAnnotations: parsePdfAnnotations(row.pdf_annotations),
    }));

    return NextResponse.json({ ok: true, attachments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "attachment_list_failed";
    const status =
      message === "not_a_member" ? 403 : message === "note_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { noteId } = await context.params;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "upload_not_configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId } = await assertNoteAccess(noteId, user.id);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";
    const stored = await uploadNoteAttachment({
      workspaceId,
      noteId,
      fileName: file.name,
      mimeType,
      buffer,
      source: "upload",
      createdBy: user.id,
    });

    await refreshNoteSearchDocument(noteId);
    const promotedRecordType = await maybePromoteNoteToDocumentRecord(noteId, mimeType);

    return NextResponse.json({
      ok: true,
      attachment: {
        id: stored.id,
        noteId: stored.noteId,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        source: stored.source,
        previewUrl: buildNoteAttachmentFileUrl(noteId, stored.id),
      },
      recordType: promotedRecordType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";
    const status =
      message === "not_a_member" ? 403 : message === "note_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}