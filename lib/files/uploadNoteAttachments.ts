import { apiFetch } from "@/lib/api/apiFetch";

export async function uploadFilesToNote(noteId: string, files: File[]): Promise<number> {
  if (!files.length) return 0;

  let uploaded = 0;
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`/api/notes/${noteId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (res.ok) uploaded += 1;
  }
  return uploaded;
}