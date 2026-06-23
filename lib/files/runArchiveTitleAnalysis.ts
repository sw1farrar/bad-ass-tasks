import { loadWorkspaceFilingTags } from "@/lib/files/loadWorkspaceFilingTags";
import { mergeWorkspaceFilingTags } from "@/lib/files/resolveSuggestedFilingTags";
import {
  generateSmartDocumentName,
  type ArchiveTitleContext,
} from "@/lib/files/generateSmartDocumentName";
import { enrichReceiptItemPolicies } from "@/lib/files/enrichReceiptItemPolicies";
import type { FileAiSuggestion } from "@/lib/files/fileAiSuggestion";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ScopedSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function loadAttachmentContext(scoped: ScopedSupabase, noteId: string) {
  const fullSelect = await (scoped.from("note_attachments") as any)
    .select("file_name, extracted_text")
    .eq("note_id", noteId);

  if (fullSelect.error?.code === "42703") {
    const legacySelect = await (scoped.from("note_attachments") as any)
      .select("file_name")
      .eq("note_id", noteId);
    if (legacySelect.error) return { fileNames: [], texts: [] };
    const rows = (legacySelect.data ?? []) as Array<{ file_name: string }>;
    return { fileNames: rows.map((r) => r.file_name), texts: [] };
  }

  if (fullSelect.error) return { fileNames: [], texts: [] };

  const rows = (fullSelect.data ?? []) as Array<{
    file_name: string;
    extracted_text?: string | null;
  }>;

  return {
    fileNames: rows.map((r) => r.file_name),
    texts: rows
      .map((r) => r.extracted_text?.trim())
      .filter((t): t is string => !!t),
  };
}

export function mergeArchiveContext(
  dbNote: Record<string, unknown> | null,
  clientContext?: ArchiveTitleContext,
): ArchiveTitleContext {
  const content =
    typeof dbNote?.content === "string"
      ? dbNote.content
      : dbNote?.content != null
        ? JSON.stringify(dbNote.content)
        : undefined;

  return {
    title: (clientContext?.title ?? (dbNote?.title as string) ?? "").trim() || undefined,
    searchPlain:
      clientContext?.searchPlain ??
      (typeof dbNote?.search_plain === "string" ? dbNote.search_plain : null),
    emailHtml:
      clientContext?.emailHtml ??
      (typeof dbNote?.raw_html === "string" ? dbNote.raw_html : null),
    noteContent: clientContext?.noteContent ?? content,
    searchDocument: clientContext?.searchDocument ?? undefined,
    memo: clientContext?.memo ?? (typeof dbNote?.memo === "string" ? dbNote.memo : null),
    recordType:
      clientContext?.recordType ??
      (typeof dbNote?.record_type === "string" ? dbNote.record_type : undefined),
    createdAt:
      clientContext?.createdAt ??
      (typeof dbNote?.created_at === "string" ? dbNote.created_at : undefined),
    attachmentFileNames: clientContext?.attachmentFileNames,
    attachmentTexts: clientContext?.attachmentTexts,
  };
}

export async function runArchiveTitleAnalysis(args: {
  scoped: ScopedSupabase;
  note: Record<string, unknown>;
  noteId: string;
  userId: string;
  workspaceId: string;
  clientContext?: ArchiveTitleContext;
  availableTags?: string[];
}): Promise<FileAiSuggestion> {
  const { scoped, note, noteId, userId, workspaceId, clientContext, availableTags } = args;
  const attachments = await loadAttachmentContext(scoped, noteId);
  const ctx = mergeArchiveContext(note, clientContext);
  const workspaceTags = mergeWorkspaceFilingTags(
    await loadWorkspaceFilingTags(scoped, workspaceId),
    availableTags,
  );

  if (!ctx.attachmentFileNames?.length && attachments.fileNames.length) {
    ctx.attachmentFileNames = attachments.fileNames;
  }
  if (!ctx.attachmentTexts?.length && attachments.texts.length) {
    ctx.attachmentTexts = attachments.texts;
  }

  const result = await generateSmartDocumentName(ctx, {
    noteId,
    userId,
    workspaceTags,
  });

  let receiptLineItems: Awaited<ReturnType<typeof enrichReceiptItemPolicies>> = [];
  if (result.isReceipt && result.receiptLineItems?.length) {
    const vendor =
      result.receiptLineItems.find((item) => item.vendor)?.vendor ??
      result.receiptLineItems[0]?.vendor ??
      "";
    const transactionDate = result.receiptLineItems[0]?.transactionDate ?? null;
    const receiptContext = [ctx.searchPlain, ...(ctx.attachmentTexts ?? []), result.memo]
      .filter(Boolean)
      .join("\n");

    try {
      receiptLineItems = await enrichReceiptItemPolicies(
        vendor,
        transactionDate,
        result.receiptLineItems,
        receiptContext,
      );
    } catch (enrichErr) {
      console.warn("[runArchiveTitleAnalysis] receipt policy enrich failed", enrichErr);
      receiptLineItems = result.receiptLineItems.map((item) => ({
        ...item,
        warranty: null,
        returnPolicy: null,
      }));
    }
  }

  const tags = (result.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  return {
    status: "ready",
    title: result.filename,
    memo: result.memo?.trim() || undefined,
    tags: tags.length ? tags : undefined,
    isReceipt: !!result.isReceipt && receiptLineItems.length > 0,
    receiptLineItems: receiptLineItems.length ? receiptLineItems : undefined,
    reasoning: result.reasoning?.trim() || undefined,
    analyzedAt: new Date().toISOString(),
  };
}