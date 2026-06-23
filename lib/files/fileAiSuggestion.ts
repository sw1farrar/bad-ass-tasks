import type { EnrichedReceiptLineItem } from "@/lib/files/enrichReceiptItemPolicies";

export type FileAiSuggestionStatus =
  | "pending"
  | "ready"
  | "failed"
  | "approved"
  | "rejected";

export type FileAiSuggestion = {
  status: FileAiSuggestionStatus;
  title?: string;
  memo?: string;
  tags?: string[];
  isReceipt?: boolean;
  receiptLineItems?: EnrichedReceiptLineItem[];
  reasoning?: string;
  error?: string;
  analyzedAt?: string;
};

export function parseFileAiSuggestion(raw: unknown): FileAiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const status = row.status;
  if (
    status !== "pending" &&
    status !== "ready" &&
    status !== "failed" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    return null;
  }

  const tags = Array.isArray(row.tags)
    ? row.tags
        .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
        .filter(Boolean)
    : undefined;

  const receiptLineItems = Array.isArray(row.receiptLineItems)
    ? (row.receiptLineItems as EnrichedReceiptLineItem[]).filter((item) =>
        item?.itemName?.trim(),
      )
    : undefined;

  return {
    status,
    title: typeof row.title === "string" ? row.title.trim() : undefined,
    memo: typeof row.memo === "string" ? row.memo.trim() : undefined,
    tags: tags?.length ? tags : undefined,
    isReceipt: row.isReceipt === true,
    receiptLineItems: receiptLineItems?.length ? receiptLineItems : undefined,
    reasoning: typeof row.reasoning === "string" ? row.reasoning.trim() : undefined,
    error: typeof row.error === "string" ? row.error.trim() : undefined,
    analyzedAt: typeof row.analyzedAt === "string" ? row.analyzedAt : undefined,
  };
}

export function isActionableFileAiSuggestion(
  suggestion: FileAiSuggestion | null | undefined,
): suggestion is FileAiSuggestion {
  return suggestion?.status === "ready" && !!suggestion.title?.trim();
}

export function fileAiSuggestionToArchivePayload(suggestion: FileAiSuggestion) {
  return {
    title: suggestion.title?.trim() ?? "",
    memo: suggestion.memo?.trim() || undefined,
    tags: suggestion.tags?.length ? suggestion.tags : undefined,
    isReceipt: !!suggestion.isReceipt && !!suggestion.receiptLineItems?.length,
    receiptLineItems: suggestion.receiptLineItems?.length
      ? suggestion.receiptLineItems
      : undefined,
  };
}