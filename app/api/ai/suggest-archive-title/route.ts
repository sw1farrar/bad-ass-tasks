import { NextResponse } from "next/server";
import type { ArchiveTitleContext } from "@/lib/files/generateSmartDocumentName";
import { runArchiveTitleAnalysis } from "@/lib/files/runArchiveTitleAnalysis";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequestBody = {
  noteId?: string;
  context?: ArchiveTitleContext;
  availableTags?: string[];
  /** When true, store the result on notes.ai_suggestion for the review queue. */
  persist?: boolean;
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
    const suggestion = await runArchiveTitleAnalysis({
      scoped,
      note,
      noteId,
      userId: user.id,
      workspaceId,
      clientContext: body.context,
      availableTags: body.availableTags,
    });

    if (body.persist) {
      await (scoped.from("notes") as any)
        .update({ ai_suggestion: suggestion })
        .eq("id", noteId);
    }

    return NextResponse.json({
      ok: true,
      filename: suggestion.title,
      title: suggestion.title,
      memo: suggestion.memo,
      tags: suggestion.tags,
      reasoning: suggestion.reasoning,
      source: "ai",
      isReceipt: suggestion.isReceipt,
      receiptLineItems: suggestion.receiptLineItems,
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