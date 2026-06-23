import { apiFetch } from "@/lib/api/apiFetch";

export type UploadFilesResult = {
  uploaded: number;
  errors: string[];
};

export async function uploadFilesToNote(noteId: string, files: File[]): Promise<UploadFilesResult> {
  if (!files.length) return { uploaded: 0, errors: [] };

  let uploaded = 0;
  const errors: string[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`/api/notes/${noteId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      uploaded += 1;
      continue;
    }
    try {
      const data = (await res.json()) as { error?: string };
      errors.push(data.error || `Failed to upload ${file.name}`);
    } catch {
      errors.push(`Failed to upload ${file.name}`);
    }
  }
  return { uploaded, errors };
}