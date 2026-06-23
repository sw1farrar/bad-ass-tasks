import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function assertWorkspaceMember(workspaceId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");
  return supabase;
}

export async function assertReceiptItemAccess(itemId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await (supabase.from("workspace_receipt_items") as any)
    .select("id, workspace_id, note_id")
    .eq("id", itemId)
    .maybeSingle();

  if (error?.code === "42P01") throw new Error("table_missing");
  if (error || !row) throw new Error("item_not_found");

  const workspaceId = String((row as { workspace_id: string }).workspace_id);
  const noteId = String((row as { note_id: string }).note_id);

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("not_a_member");

  return { supabase, workspaceId, noteId, itemId };
}