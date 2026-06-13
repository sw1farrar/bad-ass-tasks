import { describe, expect, it } from "vitest";
import { extractInlineNoteImages } from "@/lib/files/extractInlineNoteImages";
import { isImageMimeType } from "@/lib/files/isImageMimeType";

describe("isImageMimeType", () => {
  it("detects image mime types and extensions", () => {
    expect(isImageMimeType("image/jpeg")).toBe(true);
    expect(isImageMimeType("image/webp")).toBe(true);
    expect(isImageMimeType("application/pdf")).toBe(false);
    expect(isImageMimeType("", "receipt.jpg")).toBe(true);
  });
});

describe("extractInlineNoteImages", () => {
  it("extracts embedded base64 images from TipTap content", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph" },
        {
          type: "image",
          attrs: {
            src: "data:image/jpeg;base64,abc123",
            alt: "Receipt photo",
          },
        },
      ],
    });

    const images = extractInlineNoteImages(content);
    expect(images).toHaveLength(1);
    expect(images[0]?.fileName).toBe("Receipt photo");
    expect(images[0]?.mimeType).toBe("image/jpeg");
    expect(images[0]?.dataUrl).toContain("data:image/jpeg;base64,abc123");
  });

  it("returns empty for plain text or invalid JSON", () => {
    expect(extractInlineNoteImages("just text")).toEqual([]);
    expect(extractInlineNoteImages("{not valid json")).toEqual([]);
  });
});