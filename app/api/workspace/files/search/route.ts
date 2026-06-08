import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId")?.trim();
  const q = searchParams.get("q")?.trim() ?? "";
  const includePending = searchParams.get("includePending") === "true";

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!q) {
    return NextResponse.json({ results: [], query: q });
  }

  const { data, error } = await (supabase as any).rpc("search_workspace_files", {
    p_workspace_id: workspaceId,
    p_query: q,
    p_include_pending: includePending,
    p_limit: 100,
  });

  if (error) {
    return NextResponse.json({ error: error.message, results: [] }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [], query: q });
}