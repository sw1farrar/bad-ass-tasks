import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { NOTE_ATTACHMENTS_BUCKET } from "@/lib/storage/noteAttachments";

type RouteContext = { params: Promise<{ noteId: string; attachmentId: string }> };

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
    .select("id, storage_path")
    .eq("id", attachmentId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
  }

  const storagePath = (attachment as { storage_path: string }).storage_path;
  const admin = createAdminSupabaseClient();
  await admin.storage.from(NOTE_ATTACHMENTS_BUCKET).remove([storagePath]);

  const { error: deleteError } = await admin
    .from("note_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: "attachment_delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}