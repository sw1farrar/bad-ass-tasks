export type VisionImageInput = {
  dataUrl: string;
  label?: string;
};

export type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

/** Build multimodal user content with per-image labels when multiple photos are attached. */
export function buildVisionUserContent(
  userPrompt: string,
  images: VisionImageInput[],
): string | VisionContentPart[] {
  if (!images.length) return userPrompt;

  if (images.length === 1) {
    return [
      { type: "text", text: userPrompt },
      {
        type: "image_url",
        image_url: { url: images[0].dataUrl, detail: "high" },
      },
    ];
  }

  const parts: VisionContentPart[] = [
    {
      type: "text",
      text: [
        userPrompt,
        "",
        `=== ${images.length} IMAGES FOLLOW IN UPLOAD ORDER ===`,
        "Read every image before answering. They are usually separate photos of the SAME receipt or document (top, items, totals, signature).",
        "Merge evidence across all images into one analysis. For receipts, combine line_items from every page and do not duplicate the same item.",
      ].join("\n"),
    },
  ];

  images.forEach((image, index) => {
    const label = image.label?.trim() || `image-${index + 1}`;
    parts.push({
      type: "text",
      text: `\n--- Image ${index + 1} of ${images.length}: ${label} ---`,
    });
    parts.push({
      type: "image_url",
      image_url: { url: image.dataUrl, detail: "high" },
    });
  });

  return parts;
}