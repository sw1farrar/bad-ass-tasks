import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { NOTE_ATTACHMENTS_BUCKET } from "@/lib/storage/noteAttachments";

export type NoteAttachmentBuffer = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

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
}

export async function fetchNoteAttachmentBuffer(
  noteId: string,
  attachmentId: string,
  userId: string,
): Promise<NoteAttachmentBuffer> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("file_not_configured");
  }

  await assertNoteAccess(noteId, userId);

  const admin = createAdminSupabaseClient();
  const { data: attachment, error: fetchError } = await (admin.from("note_attachments") as any)
    .select("id, storage_path, mime_type, file_name")
    .eq("id", attachmentId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (fetchError || !attachment) {
    throw new Error("attachment_not_found");
  }

  const storagePath = (attachment as { storage_path: string }).storage_path;
  const mimeType =
    (attachment as { mime_type?: string }).mime_type || "application/octet-stream";
  const fileName = (attachment as { file_name?: string }).file_name || "attachment";

  const { data: blob, error: downloadError } = await admin.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .download(storagePath);

  if (downloadError || !blob) {
    throw new Error("file_download_failed");
  }

  return {
    buffer: Buffer.from(await blob.arrayBuffer()),
    fileName,
    mimeType,
  };
}