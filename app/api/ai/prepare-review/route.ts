import { NextResponse } from "next/server";
import { parseFileAiSuggestion, type FileAiSuggestion } from "@/lib/files/fileAiSuggestion";
import { runArchiveTitleAnalysis } from "@/lib/files/runArchiveTitleAnalysis";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequestBody = {
  noteId?: string;
  force?: boolean;
  availableTags?: string[];
};

async function assertPendingReviewNote(noteId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select(
      "id, workspace_id, title, search_plain, memo, record_type, created_at, content, raw_html, search_document, review_status, ai_suggestion",
    )
    .eq("id", noteId)
    .maybeSingle();

  if (error || !note) throw new Error("note_not_found");

  const row = note as Record<string, unknown>;
  if (row.review_status !== "pending_review") throw new Error("not_pending_review");

  const workspaceId = String(row.workspace_id);
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");

  return { supabase, note: row, workspaceId };
}

async function saveAiSuggestion(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  noteId: string,
  suggestion: FileAiSuggestion | null,
) {
  const { error } = await (supabase.from("notes") as any)
    .update({ ai_suggestion: suggestion })
    .eq("id", noteId);

  if (error?.code === "42703") {
    // Column not migrated yet — analysis still returned to caller.
    return false;
  }
  if (error) throw error;
  return true;
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
    const { supabase: scoped, note, workspaceId } = await assertPendingReviewNote(
      noteId,
      user.id,
    );

    const existing = parseFileAiSuggestion(note.ai_suggestion);
    if (!body.force && existing?.status === "ready" && existing.title?.trim()) {
      return NextResponse.json({ ok: true, suggestion: existing, cached: true });
    }
    if (!body.force && existing?.status === "pending") {
      return NextResponse.json({ ok: true, suggestion: existing, inProgress: true });
    }

    const pending: FileAiSuggestion = {
      status: "pending",
      analyzedAt: new Date().toISOString(),
    };
    await saveAiSuggestion(scoped, noteId, pending);

    const suggestion = await runArchiveTitleAnalysis({
      scoped,
      note,
      noteId,
      userId: user.id,
      workspaceId,
      availableTags: body.availableTags,
    });

    const persisted = await saveAiSuggestion(scoped, noteId, suggestion);

    return NextResponse.json({
      ok: true,
      suggestion,
      persisted,
      filename: suggestion.title,
      title: suggestion.title,
      memo: suggestion.memo,
      tags: suggestion.tags,
      isReceipt: suggestion.isReceipt,
      receiptLineItems: suggestion.receiptLineItems,
      reasoning: suggestion.reasoning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "prepare_failed";

    if (message === "note_not_found") {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (message === "not_a_member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message === "not_pending_review") {
      return NextResponse.json({ error: "not_pending_review" }, { status: 409 });
    }

    const failed: FileAiSuggestion = {
      status: "failed",
      error: message,
      analyzedAt: new Date().toISOString(),
    };
    try {
      const scoped = await createServerSupabaseClient();
      await saveAiSuggestion(scoped, noteId, failed);
    } catch {
      // ignore persistence errors for failed state
    }

    if (message.startsWith("ai_unavailable")) {
      const reason = message.split(":")[1] ?? "unknown";
      return NextResponse.json(
        { error: "ai_unavailable", reason, suggestion: failed },
        { status: 503 },
      );
    }
    if (message === "suggestion_rejected") {
      return NextResponse.json(
        { error: "suggestion_rejected", suggestion: failed },
        { status: 422 },
      );
    }

    return NextResponse.json({ error: "prepare_failed", suggestion: failed }, { status: 500 });
  }
}