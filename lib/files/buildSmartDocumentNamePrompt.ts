import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";
import { noteBodyPlain } from "@/lib/files/preprocessArchiveTitleContext";

const MAX_SECTION_CHARS = 12_000;
const MAX_TOTAL_CHARS = 32_000;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n…[content truncated]`;
}

export type SmartDocumentNamePromptOptions = {
  visionImages?: Array<{ fileName: string }>;
  workspaceTags?: string[];
};

/** Assemble raw document content for Grok — no pre-extraction, attachments first, subject last. */
export function buildSmartDocumentNameUserPrompt(
  ctx: ArchiveTitleContext,
  options?: SmartDocumentNamePromptOptions,
): string {
  const sections: string[] = [
    "Name this document. Steps: (1) classify document_type from all sources, (2) set subject for that type, (3) output filename, memo, and tags.",
    "Return your JSON (analysis + output). The memo should describe the document in more detail than the filename.",
    "",
  ];

  const workspaceTags = options?.workspaceTags ?? [];
  if (workspaceTags.length) {
    sections.push(
      "=== WORKSPACE FILING TAGS (pick only from this list — exact spelling) ===",
      workspaceTags.join(", "),
      "",
    );
  }

  const visionImages = options?.visionImages ?? [];
  if (visionImages.length === 1) {
    const name = visionImages[0].fileName;
    sections.push(
      "=== DOCUMENT IMAGE (1 attached for visual analysis) ===",
      `Read store names, dates, line items, form headers, and issuer names directly from the image: ${name}`,
      "When there is little or no extracted text, the image is your primary evidence.",
      "",
    );
  } else if (visionImages.length > 1) {
    const numbered = visionImages
      .map((image, index) => `${index + 1}. ${image.fileName}`)
      .join("\n");
    sections.push(
      `=== DOCUMENT IMAGES (${visionImages.length} attached — multi-photo / multi-page) ===`,
      "You will receive each image separately in upload order (Image 1 of N, Image 2 of N, …).",
      "Treat them as parts of ONE document unless they are clearly unrelated.",
      "For receipts split across photos: read ALL images before extracting vendor, date, line_items, and totals.",
      "Merge line items from every image; do not list the same purchasable item twice; ignore duplicate subtotals/tax/total rows across pages.",
      "Filename and memo must reflect the full transaction, not only the first photo.",
      numbered,
      "",
    );
  }

  if (ctx.attachmentTexts?.length) {
    ctx.attachmentTexts.forEach((text, index) => {
      const name = ctx.attachmentFileNames?.[index] ?? `attachment ${index + 1}`;
      sections.push(`=== ATTACHMENT: ${name} ===`, truncate(text), "");
    });
  } else if (ctx.attachmentFileNames?.length && !visionImages.length) {
    sections.push(
      "=== ATTACHMENTS (filenames only — no extracted text) ===",
      ctx.attachmentFileNames.join("\n"),
      "",
    );
  } else if (ctx.attachmentFileNames?.length && visionImages.length) {
    sections.push(
      "=== ATTACHMENT FILENAMES ===",
      ctx.attachmentFileNames.join("\n"),
      "",
    );
  }

  const body = noteBodyPlain(ctx);
  if (body) {
    sections.push("=== EMAIL / NOTE BODY ===", truncate(body), "");
  }

  if (ctx.memo?.trim()) {
    sections.push("=== MEMO ===", truncate(ctx.memo.trim()), "");
  }

  if (ctx.title?.trim()) {
    sections.push(
      "=== EMAIL SUBJECT (verify in body — helpful for statements/tax notices; often misleading for receipts) ===",
      truncate(ctx.title.trim()),
      "",
    );
  }

  if (ctx.createdAt) {
    sections.push(
      "=== UPLOADED TO SYSTEM (use as date only if the document has no date) ===",
      ctx.createdAt,
      "",
    );
  }

  let prompt = sections.join("\n");
  if (prompt.length > MAX_TOTAL_CHARS) {
    prompt = `${prompt.slice(0, MAX_TOTAL_CHARS)}\n…[overall context truncated]`;
  }

  return prompt;
}