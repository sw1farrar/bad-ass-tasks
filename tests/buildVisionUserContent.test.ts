import { describe, expect, it } from "vitest";
import { buildVisionUserContent } from "@/lib/ai/buildVisionUserContent";

describe("buildVisionUserContent", () => {
  it("returns plain text when there are no images", () => {
    expect(buildVisionUserContent("Name this file.", [])).toBe("Name this file.");
  });

  it("pairs one image after the prompt", () => {
    const content = buildVisionUserContent("Prompt", [
      { dataUrl: "data:image/jpeg;base64,abc", label: "receipt.jpg" },
    ]);
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "Prompt" });
    expect(content[1]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,abc", detail: "high" },
    });
  });

  it("labels each image when multiple photos are attached", () => {
    const content = buildVisionUserContent("Prompt", [
      { dataUrl: "data:image/jpeg;base64,one", label: "receipt-top.jpg" },
      { dataUrl: "data:image/jpeg;base64,two", label: "receipt-items.jpg" },
      { dataUrl: "data:image/jpeg;base64,three", label: "receipt-total.jpg" },
    ]);

    expect(Array.isArray(content)).toBe(true);
    const parts = content as Array<{ type: string; text?: string }>;
    const labels = parts.filter((part) => part.type === "text").map((part) => part.text ?? "");
    expect(labels.some((text) => text.includes("3 IMAGES FOLLOW"))).toBe(true);
    expect(labels.some((text) => text.includes("Image 1 of 3: receipt-top.jpg"))).toBe(true);
    expect(labels.some((text) => text.includes("Image 2 of 3: receipt-items.jpg"))).toBe(true);
    expect(labels.some((text) => text.includes("Image 3 of 3: receipt-total.jpg"))).toBe(true);
    expect(parts.filter((part) => part.type === "image_url")).toHaveLength(3);
  });
});