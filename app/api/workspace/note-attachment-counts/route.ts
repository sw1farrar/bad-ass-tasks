import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }

  const { data: rows, error } = await (supabase.from("note_attachments") as any)
    .select("note_id")
    .eq("workspace_id", workspaceId);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ ok: true, counts: {} });
    }
    return NextResponse.json({ error: "attachment_counts_failed" }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of (rows ?? []) as Array<{ note_id: string }>) {
    counts[row.note_id] = (counts[row.note_id] ?? 0) + 1;
  }

  return NextResponse.json({ ok: true, counts });
}