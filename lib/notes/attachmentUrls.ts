/** Stable same-origin URL for an attachment file (auth-checked GET handler). */
export function buildNoteAttachmentFileUrl(noteId: string, attachmentId: string): string {
  return `/api/notes/${encodeURIComponent(noteId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

/** Text preview for legacy binary Word (.doc) attachments. */
export function buildNoteAttachmentPreviewUrl(noteId: string, attachmentId: string): string {
  return `/api/notes/${encodeURIComponent(noteId)}/attachments/${encodeURIComponent(attachmentId)}/preview`;
}