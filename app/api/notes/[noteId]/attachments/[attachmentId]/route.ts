import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { NOTE_ATTACHMENTS_BUCKET } from "@/lib/storage/noteAttachments";
import { refreshNoteSearchDocument } from "@/lib/notes/refreshNoteSearchDocument";
import { parsePdfAnnotations } from "@/lib/pdf/annotations";
import {
  assertAttachmentStoragePath,
  attachmentContentHeaders,
} from "@/lib/notes/attachmentResponse";
type RouteContext = { params: Promise<{ noteId: string; attachmentId: string }> };

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
  const { noteId, attachmentId } = await context.params;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "file_not_configured" }, { status: 503 });
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

    const admin = createAdminSupabaseClient();
    const { data: attachment, error: fetchError } = await (admin.from("note_attachments") as any)
      .select("id, storage_path, mime_type, file_name, workspace_id")
      .eq("id", attachmentId)
      .eq("note_id", noteId)
      .maybeSingle();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
    }

    const row = attachment as {
      storage_path: string;
      mime_type?: string;
      file_name?: string;
      workspace_id?: string;
    };
    if (row.workspace_id && row.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
    }

    const storagePath = row.storage_path;
    assertAttachmentStoragePath(storagePath, workspaceId);
    const mimeType = row.mime_type || "application/octet-stream";
    const fileName = row.file_name || "attachment";

    const { data: blob, error: downloadError } = await admin.storage
      .from(NOTE_ATTACHMENTS_BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      return NextResponse.json({ error: "file_download_failed" }, { status: 500 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...attachmentContentHeaders(mimeType, fileName),
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "file_download_failed";
    const status =
      message === "not_a_member"
        ? 403
        : message === "note_not_found" || message === "attachment_path_mismatch"
          ? 404
          : 500;
    return NextResponse.json(
      { error: message === "attachment_path_mismatch" ? "attachment_not_found" : message },
      { status },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { noteId, attachmentId } = await context.params;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "update_not_configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pdfAnnotations?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pdfAnnotations = parsePdfAnnotations(body.pdfAnnotations);

  try {
    await assertNoteAccess(noteId, user.id);

    const admin = createAdminSupabaseClient();
    const { data: updated, error } = await (admin.from("note_attachments") as any)
      .update({ pdf_annotations: pdfAnnotations })
      .eq("id", attachmentId)
      .eq("note_id", noteId)
      .select("id, pdf_annotations")
      .maybeSingle();

    if (error) {
      if (error.code === "42703") {
        return NextResponse.json({ error: "pdf_annotations_column_missing" }, { status: 503 });
      }
      return NextResponse.json({ error: "annotation_save_failed" }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      pdfAnnotations: parsePdfAnnotations((updated as { pdf_annotations: unknown }).pdf_annotations),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "annotation_save_failed";
    const status =
      message === "not_a_member" ? 403 : message === "note_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { noteId, attachmentId } = await context.params;

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "delete_not_configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: note } = await supabase
    .from("notes")
    .select("workspace_id")
    .eq("id", noteId)
    .maybeSingle();

  if (!note) {
    return NextResponse.json({ error: "note_not_found" }, { status: 404 });
  }

  const workspaceId = (note as { workspace_id: string }).workspace_id;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }

  const { data: attachment, error: fetchError } = await (supabase.from("note_attachments") as any)
    .select("id, storage_path, workspace_id")
    .eq("id", attachmentId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
  }

  const storagePath = (attachment as { storage_path: string }).storage_path;
  try {
    assertAttachmentStoragePath(storagePath, workspaceId);
  } catch {
    return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
  }
  const admin = createAdminSupabaseClient();
  await admin.storage.from(NOTE_ATTACHMENTS_BUCKET).remove([storagePath]);

  const { error: deleteError } = await admin
    .from("note_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: "attachment_delete_failed" }, { status: 500 });
  }

  await refreshNoteSearchDocument(noteId);

  return NextResponse.json({ ok: true });
}