import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequestBody = {
  noteId?: string;
  status?: "rejected" | "approved";
};

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

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id, workspace_id")
    .eq("id", noteId)
    .maybeSingle();

  if (noteError || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const workspaceId = (note as { workspace_id: string }).workspace_id;
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await (supabase.from("notes") as any)
    .update({ ai_suggestion: null })
    .eq("id", noteId);

  if (error?.code === "42703") {
    return NextResponse.json({ ok: true, persisted: false });
  }
  if (error) {
    return NextResponse.json({ error: "clear_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    status: body.status ?? "rejected",
  });
}