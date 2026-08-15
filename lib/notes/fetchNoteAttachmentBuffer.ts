import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { NOTE_ATTACHMENTS_BUCKET } from "@/lib/storage/noteAttachments";
import { assertAttachmentStoragePath } from "@/lib/notes/attachmentResponse";

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
  return workspaceId;
}

export async function fetchNoteAttachmentBuffer(
  noteId: string,
  attachmentId: string,
  userId: string,
): Promise<NoteAttachmentBuffer> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("file_not_configured");
  }

  const workspaceId = await assertNoteAccess(noteId, userId);

  const admin = createAdminSupabaseClient();
  const { data: attachment, error: fetchError } = await (admin.from("note_attachments") as any)
    .select("id, storage_path, mime_type, file_name, workspace_id")
    .eq("id", attachmentId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (fetchError || !attachment) {
    throw new Error("attachment_not_found");
  }

  const row = attachment as {
    storage_path: string;
    mime_type?: string;
    file_name?: string;
    workspace_id?: string;
  };
  if (row.workspace_id && row.workspace_id !== workspaceId) {
    throw new Error("attachment_not_found");
  }

  const storagePath = row.storage_path;
  assertAttachmentStoragePath(storagePath, workspaceId);
  const mimeType = row.mime_type || "application/octet-stream";
  const fileName = row.file_name || "attachment";

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