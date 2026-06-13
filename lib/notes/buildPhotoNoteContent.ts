import { fileToDataUrl } from "@/features/notes/editor/lib/clipboard-images";

type TipTapNode = {
  type: string;
  attrs?: Record<string, string>;
};

/** Embed compressed photos inline for demo/offline viewing. */
export async function buildPhotoNoteContent(files: File[]): Promise<string> {
  const nodes: TipTapNode[] = [{ type: "paragraph" }];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const src = await fileToDataUrl(file);
    nodes.push({
      type: "image",
      attrs: {
        src,
        alt: `Photo ${index + 1}`,
        title: file.name,
      },
    });
  }

  return JSON.stringify({ type: "doc", content: nodes });
}