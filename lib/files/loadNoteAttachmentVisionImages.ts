import "server-only";

import { isImageMimeType } from "@/lib/files/isImageMimeType";
import { NOTE_ATTACHMENTS_BUCKET } from "@/lib/storage/noteAttachments";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VisionImage = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

const MAX_VISION_IMAGES = 5;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

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

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Download image attachments for Grok vision analysis. */
export async function loadNoteAttachmentVisionImages(
  noteId: string,
  userId: string,
): Promise<VisionImage[]> {
  if (!isSupabaseAdminConfigured()) return [];

  await assertNoteAccess(noteId, userId);

  const admin = createAdminSupabaseClient();
  const { data: rows, error } = await (admin.from("note_attachments") as any)
    .select("file_name, mime_type, storage_path")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) return [];

  const images: VisionImage[] = [];

  for (const row of rows as Array<{
    file_name: string;
    mime_type?: string | null;
    storage_path: string;
  }>) {
    if (images.length >= MAX_VISION_IMAGES) break;

    const fileName = row.file_name?.trim() || "attachment";
    const mimeType = row.mime_type?.trim() || "application/octet-stream";
    if (!isImageMimeType(mimeType, fileName)) continue;

    const { data: blob, error: downloadError } = await admin.storage
      .from(NOTE_ATTACHMENTS_BUCKET)
      .download(row.storage_path);

    if (downloadError || !blob) continue;

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) continue;

    images.push({
      fileName,
      mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      dataUrl: bufferToDataUrl(buffer, mimeType.startsWith("image/") ? mimeType : "image/jpeg"),
    });
  }

  return images;
}