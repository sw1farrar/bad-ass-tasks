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

  const { data: rows, error } = await (supabase as any).rpc(
    "note_attachment_counts_by_workspace",
    { p_workspace_id: workspaceId },
  );

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST202") {
      const { data: fallbackRows, error: fallbackError } = await (
        supabase.from("note_attachments") as any
      )
        .select("note_id")
        .eq("workspace_id", workspaceId);

      if (fallbackError) {
        if (fallbackError.code === "42P01") {
          return NextResponse.json({ ok: true, counts: {} });
        }
        return NextResponse.json({ error: "attachment_counts_failed" }, { status: 500 });
      }

      const counts: Record<string, number> = {};
      for (const row of (fallbackRows ?? []) as Array<{ note_id: string }>) {
        counts[row.note_id] = (counts[row.note_id] ?? 0) + 1;
      }
      return NextResponse.json({ ok: true, counts });
    }
    return NextResponse.json({ error: "attachment_counts_failed" }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of (rows ?? []) as Array<{ note_id: string; attachment_count: number }>) {
    counts[row.note_id] = Number(row.attachment_count) || 0;
  }

  return NextResponse.json({ ok: true, counts });
}