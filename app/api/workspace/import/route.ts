import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fromDbRole } from "@/lib/roles";
import {
  IMPORT_CHUNK_MAX,
  importSchemaMissingMessage,
  runImportChunk,
  type ImportChunkRequest,
} from "@/lib/import/importChunk";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportChunkRequest;
  try {
    body = (await request.json()) as ImportChunkRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  if (["w1", "w2"].includes(workspaceId)) {
    return NextResponse.json({ error: "Demo workspaces cannot be imported into" }, { status: 400 });
  }

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json(
      { error: memberError.message || "Could not verify membership" },
      { status: 500 },
    );
  }

  const role = fromDbRole((membership as { role?: string } | null)?.role);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Only owners and admins can import tasks" }, { status: 403 });
  }

  const result = await runImportChunk(supabase as unknown as { from: (table: string) => unknown }, user.id, {
    ...body,
    workspaceId,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error || importSchemaMissingMessage() },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json(result.result);
}

export { IMPORT_CHUNK_MAX };
