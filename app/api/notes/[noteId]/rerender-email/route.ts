import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  buildCidMapFromAttachmentsForNote,
  rerenderEmailNoteContent,
} from "@/lib/notes/rerenderEmailNote";

type RouteContext = { params: Promise<{ noteId: string }> };

async function assertNoteAccess(noteId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: note, error } = await supabase
    .from("notes")
    .select("id, workspace_id, raw_html, tags")
    .eq("id", noteId)
    .maybeSingle();

  if (error || !note) throw new Error("note_not_found");

  const row = note as {
    id: string;
    workspace_id: string;
    raw_html: string | null;
    tags: string[];
  };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", row.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");

  return row;
}

export async function POST(_request: Request, context: RouteContext) {
  const { noteId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }

  try {
    const note = await assertNoteAccess(noteId, user.id);

    if (!note.tags?.includes("from-email")) {
      return NextResponse.json({ error: "not_an_email_note" }, { status: 400 });
    }

    const rawHtml = note.raw_html?.trim();
    if (!rawHtml) {
      return NextResponse.json({ error: "no_raw_html_archived" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: attachments, error: attError } = await (admin.from("note_attachments") as any)
      .select("id, content_id")
      .eq("note_id", noteId);

    if (attError && attError.code !== "42703") {
      return NextResponse.json({ error: "attachment_lookup_failed" }, { status: 500 });
    }

    const cidToUrl = buildCidMapFromAttachmentsForNote(
      noteId,
      (attachments ?? []) as Array<{ id: string; content_id: string | null }>,
    );

    const { content, searchPlain, pipelineVersion } = rerenderEmailNoteContent({
      item: { RawHtmlBody: rawHtml },
      rawHtml,
      cidToUrl,
    });

    const updatePayload: Record<string, unknown> = {
      content,
      search_plain: searchPlain,
      email_pipeline_version: pipelineVersion,
      updated_at: new Date().toISOString(),
    };

    let { error: updateError } = await (admin.from("notes") as any)
      .update(updatePayload)
      .eq("id", noteId);

    if (updateError?.code === "42703") {
      ({ error: updateError } = await (admin.from("notes") as any)
        .update({ content, updated_at: updatePayload.updated_at })
        .eq("id", noteId));
    }

    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pipelineVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const status = message === "not_a_member" ? 403 : message === "note_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}