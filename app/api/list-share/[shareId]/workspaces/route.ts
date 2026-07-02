import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidListShareId } from "@/lib/list-share/getListSharePreview";

type RouteContext = { params: Promise<{ shareId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { shareId } = await context.params;

  if (!isValidListShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  type RpcClient = {
    rpc: (
      name: string,
      args: { p_invite_id: string },
    ) => Promise<{
      data: Array<{
        workspace_id: string;
        workspace_name: string;
        already_linked: boolean;
      }> | null;
      error: { message?: string } | null;
    }>;
  };

  const { data, error } = await (supabase as unknown as RpcClient).rpc(
    "get_list_share_linked_workspaces",
    { p_invite_id: shareId },
  );

  if (error) {
    return NextResponse.json({ error: error.message || "Could not load workspaces" }, { status: 400 });
  }

  const workspaces = (data ?? []).map((row) => ({
    id: row.workspace_id,
    name: row.workspace_name,
    alreadyLinked: row.already_linked,
  }));

  return NextResponse.json({ workspaces });
}