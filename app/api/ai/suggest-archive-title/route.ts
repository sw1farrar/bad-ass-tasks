import { NextResponse } from "next/server";
import { loadWorkspaceFilingTags } from "@/lib/files/loadWorkspaceFilingTags";
import { mergeWorkspaceFilingTags } from "@/lib/files/resolveSuggestedFilingTags";
import {
  generateSmartDocumentName,
  type ArchiveTitleContext,
} from "@/lib/files/generateSmartDocumentName";
import { enrichReceiptItemPolicies } from "@/lib/files/enrichReceiptItemPolicies";
import { persistReceiptLineItems } from "@/lib/files/persistReceiptLineItems";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequestBody = {
  noteId?: string;
  context?: ArchiveTitleContext;
  availableTags?: string[];
};

function aiUnavailableMessage(reason: string): string {
  switch (reason) {
    case "missing_key":
      return "Add XAI_API_KEY to .env.local (from console.x.ai), then restart the dev server.";
    case "sim_forced":
      return "AI is disabled (AI_FORCE_SIM=1). Remove it from .env.local and restart.";
    case "http_error":
      return "Grok API rejected the request. Check your API key and account credits.";
    case "network_error":
      return "Could not reach Grok. Check your network connection.";
    case "empty_response":
      return "Grok returned an empty response. Try again.";
    default:
      return "Server AI is not configured or unreachable.";
  }
}

async function assertNoteAccess(noteId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select(
      "id, workspace_id, title, search_plain, memo, record_type, created_at, content, raw_html, search_document",
    )
    .eq("id", noteId)
    .maybeSingle();

  if (error || !note) throw new Error("note_not_found");

  const workspaceId = (note as { workspace_id: string }).workspace_id;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");

  return {
    supabase,
    note: note as Record<string, unknown>,
    workspaceId,
  };
}

async function loadAttachmentContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  noteId: string,
): Promise<{ fileNames: string[]; texts: string[] }> {
  const fullSelect = await (supabase.from("note_attachments") as any)
    .select("file_name, extracted_text")
    .eq("note_id", noteId);

  if (fullSelect.error?.code === "42703") {
    const legacySelect = await (supabase.from("note_attachments") as any)
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

function mergeContext(
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

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const noteId = body.noteId?.trim();
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  try {
    const { supabase: scoped, note, workspaceId } = await assertNoteAccess(noteId, user.id);
    const attachments = await loadAttachmentContext(scoped, noteId);
    const ctx = mergeContext(note, body.context);
    const workspaceTags = mergeWorkspaceFilingTags(
      await loadWorkspaceFilingTags(scoped, workspaceId),
      body.availableTags,
    );

    if (!ctx.attachmentFileNames?.length && attachments.fileNames.length) {
      ctx.attachmentFileNames = attachments.fileNames;
    }
    if (!ctx.attachmentTexts?.length && attachments.texts.length) {
      ctx.attachmentTexts = attachments.texts;
    }

    const result = await generateSmartDocumentName(ctx, {
      noteId,
      userId: user.id,
      workspaceTags,
    });

    let receiptItemsLogged = 0;
    if (result.isReceipt && result.receiptLineItems?.length) {
      const vendor =
        result.receiptLineItems.find((item) => item.vendor)?.vendor ??
        result.receiptLineItems[0]?.vendor ??
        "";
      const transactionDate = result.receiptLineItems[0]?.transactionDate ?? null;
      const receiptContext = [
        ctx.searchPlain,
        ...(ctx.attachmentTexts ?? []),
        result.memo,
      ]
        .filter(Boolean)
        .join("\n");

      const enriched = await enrichReceiptItemPolicies(
        vendor,
        transactionDate,
        result.receiptLineItems,
        receiptContext,
      );

      try {
        const persisted = await persistReceiptLineItems(
          scoped,
          workspaceId,
          noteId,
          enriched,
        );
        receiptItemsLogged = persisted.inserted;
      } catch (persistErr) {
        console.warn("[suggest-archive-title] receipt items persist failed", persistErr);
      }
    }

    return NextResponse.json({
      ok: true,
      filename: result.filename,
      title: result.filename,
      memo: result.memo,
      tags: result.tags,
      reasoning: result.reasoning,
      source: result.source,
      receiptItemsLogged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "suggest_failed";
    if (message === "note_not_found") {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (message === "not_a_member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.startsWith("ai_unavailable")) {
      const reason = message.split(":")[1] ?? "unknown";
      return NextResponse.json(
        {
          error: "ai_unavailable",
          reason,
          message: aiUnavailableMessage(reason),
        },
        { status: 503 },
      );
    }
    if (message === "suggestion_rejected") {
      return NextResponse.json(
        { error: "suggestion_rejected", message: "AI could not produce a confident filename." },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "Failed to suggest title" }, { status: 500 });
  }
}