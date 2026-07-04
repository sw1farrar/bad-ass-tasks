import {
  callXaiChat,
  getXaiUnavailableReason,
  type XaiChatFailure,
  type XaiVisionImage,
} from "@/lib/ai/xaiClient";
import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";
import { buildSmartDocumentNameUserPrompt } from "@/lib/files/buildSmartDocumentNamePrompt";
import {
  extractReceiptLineItemsFromEmailHtml,
  extractReceiptLineItemsFromPlainBody,
} from "@/lib/files/extractEmailReceiptLineItems";
import { noteBodyPlain } from "@/lib/files/preprocessArchiveTitleContext";
import { extractInlineNoteImages } from "@/lib/files/extractInlineNoteImages";
import { preprocessArchiveTitleSignals } from "@/lib/files/preprocessArchiveTitleContext";
import { sanitizeArchiveTitleContext } from "@/lib/files/sanitizeArchiveTitleContext";
import { SMART_DOCUMENT_NAME_SYSTEM_PROMPT } from "@/lib/files/smartDocumentNamePrompt";
import { resolveSuggestedFilingTags } from "@/lib/files/resolveSuggestedFilingTags";
import {
  parseReceiptLineItemsFromAnalysis,
  type ReceiptLineItemInput,
} from "@/lib/files/receiptLineItems";
import {
  getSmartFilenameRejectionReason,
  sanitizeSmartFilename,
  sanitizeSmartMemo,
  type SmartDocumentNameResult,
} from "@/lib/files/smartDocumentName";

export type SmartDocumentNameOptions = {
  noteId?: string;
  userId?: string;
  workspaceTags?: string[];
};

type AiResponseShape = {
  analysis?: {
    document_type?: string;
    what_i_read?: string;
    evidence_summary?: string;
    vendor_or_issuer?: string;
    document_date?: string;
    receipt_line_item?: string;
    item_category?: string;
    line_items?: Array<Record<string, unknown>>;
  };
  output?: { filename?: string; memo?: string; tags?: string[]; reasoning?: string };
  filename?: string;
  memo?: string;
  tags?: string[];
  reasoning?: string;
};

function buildMemoFallback(
  parsed: AiResponseShape,
  output: { memo?: string; reasoning?: string },
): string {
  const direct = sanitizeSmartMemo(String(output.memo ?? parsed.memo ?? "").trim());
  if (direct) return direct;

  const fromAnalysis = sanitizeSmartMemo(
    String(parsed.analysis?.what_i_read ?? parsed.analysis?.evidence_summary ?? "").trim(),
  );
  if (fromAnalysis) return fromAnalysis;

  const reasoning = sanitizeSmartMemo(String(output.reasoning ?? parsed.reasoning ?? "").trim());
  return reasoning || "AI analyzed document content.";
}

function parseAiResponse(
  raw: string,
  workspaceTags: string[],
): {
  filename: string;
  memo: string;
  tags: string[];
  reasoning: string;
  receiptLineItems: SmartDocumentNameResult["receiptLineItems"];
  isReceipt: boolean;
} | null {
  try {
    const parsed = JSON.parse(raw) as AiResponseShape;
    const output = parsed.output ?? parsed;
    const filename = sanitizeSmartFilename(String(output.filename ?? "").trim());
    const reasoning = String(
      output.reasoning ?? parsed.analysis?.what_i_read ?? parsed.analysis?.evidence_summary ?? "",
    ).trim();
    if (!filename) return null;

    const analysis = parsed.analysis as Record<string, unknown> | undefined;
    const isReceipt = analysis?.document_type === "receipt";
    const receiptLineItems = isReceipt
      ? parseReceiptLineItemsFromAnalysis(analysis, {
          vendor:
            typeof analysis?.vendor_or_issuer === "string" ? analysis.vendor_or_issuer : null,
          transactionDate:
            typeof analysis?.document_date === "string" ? analysis.document_date : null,
        })
      : [];

    return {
      filename,
      memo: buildMemoFallback(parsed, output),
      tags: resolveSuggestedFilingTags(output.tags ?? parsed.tags, workspaceTags),
      reasoning: reasoning || "AI analyzed document content.",
      receiptLineItems,
      isReceipt,
    };
  } catch {
    return null;
  }
}

function buildRetryPrompt(
  userPrompt: string,
  previous: { filename: string; reasoning: string } | null,
  reason: string,
): string {
  return [
    userPrompt,
    "",
    "Your previous answer was rejected.",
    previous ? `Previous filename: ${previous.filename}` : "Previous filename: (missing)",
    `Problem: ${reason}`,
    "",
    "Re-read the sources. Return corrected JSON (analysis + output). Fix only what was wrong.",
  ].join("\n");
}

function unavailableError(reason: XaiChatFailure): Error {
  const err = new Error(`ai_unavailable:${reason}`);
  return err;
}

async function callGrok(
  userPrompt: string,
  temperature: number,
  images?: XaiVisionImage[],
): Promise<string | null> {
  const result = await callXaiChat({
    systemPrompt: SMART_DOCUMENT_NAME_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
    temperature,
    maxTokens: 2200,
    images,
  });
  if (!result.ok) {
    throw unavailableError(result.error);
  }
  return result.content;
}

async function resolveVisionImages(
  ctx: ArchiveTitleContext,
  options?: SmartDocumentNameOptions,
): Promise<XaiVisionImage[]> {
  const seen = new Set<string>();
  const images: XaiVisionImage[] = [];

  const push = (fileName: string, dataUrl: string) => {
    const key = `${fileName}|${dataUrl.length}|${dataUrl.slice(-96)}`;
    if (seen.has(key)) return;
    seen.add(key);
    images.push({ dataUrl, label: fileName });
  };

  if (options?.noteId && options.userId) {
    try {
      const { loadNoteAttachmentVisionImages } = await import(
        "@/lib/files/loadNoteAttachmentVisionImages"
      );
      const stored = await loadNoteAttachmentVisionImages(options.noteId, options.userId);
      for (const image of stored) {
        push(image.fileName, image.dataUrl);
      }
    } catch {
      // Access or storage errors fall back to text-only context.
    }
  }

  for (const image of extractInlineNoteImages(ctx.noteContent)) {
    push(image.fileName, image.dataUrl);
  }

  return images.slice(0, 5);
}

function mergeReceiptLineItemsWithEmailFallback(
  parsed: {
    receiptLineItems: SmartDocumentNameResult["receiptLineItems"];
    isReceipt: boolean;
  },
  ctx: ArchiveTitleContext,
): ReceiptLineItemInput[] {
  const signals = preprocessArchiveTitleSignals(ctx);
  let emailItems =
    signals.emailReceiptLineItems.length > 0
      ? signals.emailReceiptLineItems
      : ctx.emailHtml?.trim()
        ? extractReceiptLineItemsFromEmailHtml(ctx.emailHtml)
        : [];

  if (emailItems.length < 2) {
    const bodyText = noteBodyPlain(ctx);
    const fromBody = bodyText.trim() ? extractReceiptLineItemsFromPlainBody(bodyText) : [];
    if (fromBody.length > emailItems.length) {
      emailItems = fromBody;
    } else if (fromBody.length && emailItems.length) {
      const mergedBody = new Map<string, ReceiptLineItemInput>();
      for (const item of [...emailItems, ...fromBody]) {
        const key = `${item.itemName.toLowerCase()}|${item.pricePaid ?? ""}`;
        if (!mergedBody.has(key)) mergedBody.set(key, item);
      }
      emailItems = [...mergedBody.values()];
    }
  }

  if (!emailItems.length) return parsed.receiptLineItems ?? [];

  const looksLikeReceipt =
    parsed.isReceipt ||
    emailItems.length >= 2 ||
    /\b(receipt|order|purchase|confirmation|invoice|sale\s+information|transaction\s+date)\b/i.test(
      [ctx.title, ctx.searchPlain, ctx.emailHtml, noteBodyPlain(ctx)].filter(Boolean).join(" "),
    );

  if (!looksLikeReceipt) return parsed.receiptLineItems ?? [];

  const aiItems = parsed.receiptLineItems ?? [];
  if (emailItems.length >= 2 && aiItems.length < emailItems.length) {
    const merged = new Map<string, ReceiptLineItemInput>();
    for (const item of emailItems) {
      merged.set(`${item.itemName.toLowerCase()}|${item.pricePaid ?? ""}`, item);
    }
    for (const item of aiItems) {
      const key = `${item.itemName.toLowerCase()}|${item.pricePaid ?? ""}`;
      if (!merged.has(key)) merged.set(key, item);
    }
    return [...merged.values()];
  }

  const merged = new Map<string, ReceiptLineItemInput>();
  for (const item of aiItems) {
    merged.set(`${item.itemName.toLowerCase()}|${item.pricePaid ?? ""}`, item);
  }
  for (const item of emailItems) {
    const key = `${item.itemName.toLowerCase()}|${item.pricePaid ?? ""}`;
    if (!merged.has(key)) merged.set(key, item);
  }

  return [...merged.values()];
}

/**
 * Analyze document content with Grok and return a smart filename.
 * No local rewriting — the model does the reasoning; we only sanitize characters.
 */
export async function generateSmartDocumentName(
  rawCtx: ArchiveTitleContext,
  options?: SmartDocumentNameOptions,
): Promise<SmartDocumentNameResult> {
  const ctx = sanitizeArchiveTitleContext(rawCtx);

  const unavailable = getXaiUnavailableReason();
  if (unavailable) {
    throw unavailableError(unavailable);
  }

  const workspaceTags = options?.workspaceTags ?? [];
  const visionImages = await resolveVisionImages(ctx, options);
  const userPrompt = buildSmartDocumentNameUserPrompt(ctx, {
    visionImages: visionImages.map((image) => ({
      fileName: image.label ?? "image",
    })),
    workspaceTags,
  });

  let aiRaw: string;
  try {
    const first = await callGrok(userPrompt, 0.2, visionImages);
    if (!first) throw unavailableError("empty_response");
    aiRaw = first;
  } catch (err) {
    throw err instanceof Error ? err : unavailableError("network_error");
  }

  let parsed = parseAiResponse(aiRaw, workspaceTags);
  let rejection = parsed ? getSmartFilenameRejectionReason(parsed.filename) : "Response missing a valid filename.";

  if (rejection) {
    const retryRaw = await callGrok(
      buildRetryPrompt(userPrompt, parsed, rejection),
      0.1,
      visionImages,
    );
    if (retryRaw) {
      parsed = parseAiResponse(retryRaw, workspaceTags);
      rejection = parsed ? getSmartFilenameRejectionReason(parsed.filename) : "Response missing a valid filename.";
    }
  }

  if (!parsed || rejection) {
    throw new Error("suggestion_rejected");
  }

  const receiptLineItems = mergeReceiptLineItemsWithEmailFallback(parsed, ctx);
  const isReceipt =
    parsed.isReceipt || ((receiptLineItems?.length ?? 0) > 0 && !!ctx.emailHtml?.trim());

  return {
    filename: parsed.filename,
    memo: parsed.memo,
    tags: parsed.tags,
    reasoning: parsed.reasoning,
    source: "ai",
    receiptLineItems,
    isReceipt,
  };
}

export type { ArchiveTitleContext };