import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  mergeWorkspaceSettings,
  parseWorkspaceSettings,
  type WorkspaceSettings,
} from "@/lib/workspace/workspaceSettings";

export type UpdateWorkspaceDetailsResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Server-only workspace name/slug update (service role) after owner authorization
 * has been verified by the API route.
 */
export async function executeUpdateWorkspaceDetails(params: {
  workspaceId: string;
  name?: string;
  slug?: string;
  settings?: WorkspaceSettings;
  existingSettings?: unknown;
}): Promise<UpdateWorkspaceDetailsResult> {
  const { workspaceId } = params;
  const name = params.name?.trim();
  const slug = params.slug !== undefined ? sanitizeSlug(params.slug) : undefined;
  const settingsPatch = params.settings;

  if (!workspaceId) {
    return { ok: false, error: "Missing workspace id", status: 400 };
  }
  if (!name && slug === undefined && !settingsPatch) {
    return { ok: false, error: "No changes provided", status: 400 };
  }
  if (name !== undefined && !name) {
    return { ok: false, error: "Workspace name cannot be empty", status: 400 };
  }
  if (slug !== undefined && !slug) {
    return { ok: false, error: "Workspace URL slug cannot be empty", status: 400 };
  }

  const admin = createAdminSupabaseClient();
  const updates: { name?: string; slug?: string; settings?: WorkspaceSettings } = {};
  if (name) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (settingsPatch) {
    updates.settings = mergeWorkspaceSettings(
      parseWorkspaceSettings(params.existingSettings),
      settingsPatch,
    );
  }

  const { error } = await (admin.from("workspaces") as ReturnType<typeof admin.from>)
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    const message = error.message || "Failed to update workspace";
    const status = message.toLowerCase().includes("duplicate") ? 409 : 500;
    return { ok: false, error: message, status };
  }

  return { ok: true };
}