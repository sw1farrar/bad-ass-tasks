import { describe, it, expect } from "vitest";
import { getClipboardImageFiles, getDroppedImageFiles } from "@/features/notes/editor/lib/clipboard-images";

describe("clipboard-images", () => {
  it("collects image files from clipboard items", () => {
    const file = new File(["x"], "shot.png", { type: "image/png" });
    const item = {
      kind: "file",
      type: "image/png",
      getAsFile: () => file,
    };
    const clipboardData = {
      items: [item],
      files: [] as unknown as FileList,
    } as unknown as DataTransfer;

    expect(getClipboardImageFiles(clipboardData)).toEqual([file]);
  });

  it("falls back to clipboard files", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const clipboardData = {
      items: [],
      files: [file],
    } as unknown as DataTransfer;

    expect(getClipboardImageFiles(clipboardData)).toEqual([file]);
  });

  it("filters dropped files to images only", () => {
    const img = new File(["x"], "a.png", { type: "image/png" });
    const pdf = new File(["x"], "b.pdf", { type: "application/pdf" });
    const dataTransfer = {
      files: [img, pdf],
    } as unknown as DataTransfer;

    expect(getDroppedImageFiles(dataTransfer)).toEqual([img]);
  });
});