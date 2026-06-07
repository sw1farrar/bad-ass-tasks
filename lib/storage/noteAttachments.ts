import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const NOTE_ATTACHMENTS_BUCKET = "note-attachments";

export type StoredNoteAttachment = {
  id: string;
  noteId: string;
  workspaceId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  source: "email" | "upload";
  createdBy: string | null;
};

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "attachment";
  return base.slice(0, 180);
}

export function buildNoteAttachmentStoragePath(
  workspaceId: string,
  noteId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${workspaceId}/${noteId}/${attachmentId}/${sanitizeFileName(fileName)}`;
}

export async function uploadNoteAttachment(params: {
  workspaceId: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer | Buffer;
  source: "email" | "upload";
  createdBy?: string | null;
  contentId?: string | null;
}): Promise<StoredNoteAttachment> {
  const supabase = createAdminSupabaseClient();
  const attachmentId = crypto.randomUUID();
  const storagePath = buildNoteAttachmentStoragePath(
    params.workspaceId,
    params.noteId,
    attachmentId,
    params.fileName,
  );

  const body =
    params.buffer instanceof Buffer
      ? params.buffer
      : Buffer.from(new Uint8Array(params.buffer));

  const { error: uploadError } = await supabase.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .upload(storagePath, body, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`storage_upload_failed:${uploadError.message}`);
  }

  const insertRow: Record<string, unknown> = {
    id: attachmentId,
    note_id: params.noteId,
    workspace_id: params.workspaceId,
    file_name: params.fileName,
    mime_type: params.mimeType || "application/octet-stream",
    size_bytes: body.byteLength,
    storage_path: storagePath,
    source: params.source,
    created_by: params.createdBy ?? null,
  };
  if (params.contentId) {
    insertRow.content_id = params.contentId;
  }

  let { data: row, error: insertError } = await (supabase.from("note_attachments") as any)
    .insert(insertRow)
    .select("id, note_id, workspace_id, file_name, mime_type, size_bytes, storage_path, source, created_by")
    .single();

  if (insertError?.code === "42703" && params.contentId) {
    delete insertRow.content_id;
    ({ data: row, error: insertError } = await (supabase.from("note_attachments") as any)
      .insert(insertRow)
      .select("id, note_id, workspace_id, file_name, mime_type, size_bytes, storage_path, source, created_by")
      .single());
  }

  if (insertError || !row) {
    await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`attachment_row_insert_failed:${insertError?.message ?? "unknown"}`);
  }

  return {
    id: row.id,
    noteId: row.note_id,
    workspaceId: row.workspace_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    source: row.source,
    createdBy: row.created_by,
  };
}

export async function createSignedAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}