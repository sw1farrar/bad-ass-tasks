import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { executeTransferOwnership } from "@/lib/workspace/transferOwnership";

type TransferBody = {
  workspaceId?: string;
  newOwnerId?: string;
};

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Ownership transfer is not configured on the server (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TransferBody;
  try {
    body = (await request.json()) as TransferBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  const newOwnerId = body.newOwnerId?.trim();

  if (!workspaceId || !newOwnerId) {
    return NextResponse.json({ error: "workspaceId and newOwnerId are required" }, { status: 400 });
  }

  if (["w1", "w2"].includes(workspaceId)) {
    return NextResponse.json({ error: "Demo workspaces cannot transfer ownership" }, { status: 400 });
  }

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message || "Could not verify membership" }, { status: 500 });
  }

  const role = (membership as { role?: string } | null)?.role;
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can transfer ownership" }, { status: 403 });
  }

  const result = await executeTransferOwnership({
    workspaceId,
    currentOwnerId: user.id,
    newOwnerId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}