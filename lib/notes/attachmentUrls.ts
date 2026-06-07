/** Stable same-origin URL for an attachment file (auth-checked GET handler). */
export function buildNoteAttachmentFileUrl(noteId: string, attachmentId: string): string {
  return `/api/notes/${encodeURIComponent(noteId)}/attachments/${encodeURIComponent(attachmentId)}`;
}