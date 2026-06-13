import "server-only";

import { mergeWorkspaceFilingTags } from "@/lib/files/resolveSuggestedFilingTags";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/** Load distinct filing tags already used in a workspace (from archived and pending notes). */
export async function loadWorkspaceFilingTags(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  workspaceId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("tags")
    .eq("workspace_id", workspaceId);

  if (error || !data?.length) return [];

  const tagLists = (data as Array<{ tags?: string[] | null }>).map((row) => row.tags ?? []);
  return mergeWorkspaceFilingTags(...tagLists);
}