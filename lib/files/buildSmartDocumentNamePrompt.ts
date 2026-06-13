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
  if (visionImages.length) {
    const names = visionImages.map((image) => image.fileName).join(", ");
    sections.push(
      `=== DOCUMENT IMAGES (${visionImages.length} attached for visual analysis) ===`,
      `Read store names, dates, line items, form headers, and issuer names directly from the image(s): ${names}`,
      "When there is little or no extracted text, the image(s) are your primary evidence.",
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