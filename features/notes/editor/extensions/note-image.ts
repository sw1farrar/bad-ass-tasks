import Image from "@tiptap/extension-image";

/** Images scaled to note content width; base64 paste/upload supported. */
export const NoteImage = Image.configure({
  inline: false,
  allowBase64: true,
  HTMLAttributes: {
    class: "note-editor-image",
    loading: "lazy",
    decoding: "async",
    draggable: "false",
    "data-previewable": "true",
  },
});