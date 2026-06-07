import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteWorkspaceTaskInbox,
  updateWorkspaceTaskInbox,
} from "@/lib/email-inbox/taskInboxService";

type PatchBody = {
  workspaceId?: string;
  isActive?: boolean;
  label?: string;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const inbox = await updateWorkspaceTaskInbox({
      inboxId: id,
      workspaceId,
      userId: user.id,
      isActive: body.isActive,
      label: body.label,
    });
    return NextResponse.json({ ok: true, inbox });
  } catch (err) {
    const message = err instanceof Error ? err.message : "inbox_update_failed";
    const status = message === "not_a_member" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
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

  try {
    await deleteWorkspaceTaskInbox({ inboxId: id, workspaceId, userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "inbox_delete_failed";
    const status = message === "not_a_member" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}