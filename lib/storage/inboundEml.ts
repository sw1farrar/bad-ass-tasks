import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NOTE_ATTACHMENTS_BUCKET } from "./noteAttachments";

export function buildInboundEmlStoragePath(
  workspaceId: string,
  noteId: string,
  messageId: string,
): string {
  const safeId = messageId.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 120);
  return `${workspaceId}/${noteId}/source/${safeId}.eml`;
}

export async function storeInboundEml(params: {
  workspaceId: string;
  noteId: string;
  messageId: string;
  buffer: ArrayBuffer | Buffer;
}): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const storagePath = buildInboundEmlStoragePath(
    params.workspaceId,
    params.noteId,
    params.messageId,
  );

  const body =
    params.buffer instanceof Buffer
      ? params.buffer
      : Buffer.from(new Uint8Array(params.buffer));

  const { error } = await supabase.storage
    .from(NOTE_ATTACHMENTS_BUCKET)
    .upload(storagePath, body, {
      contentType: "message/rfc822",
      upsert: true,
    });

  if (error) {
    throw new Error(`eml_storage_upload_failed:${error.message}`);
  }

  return storagePath;
}