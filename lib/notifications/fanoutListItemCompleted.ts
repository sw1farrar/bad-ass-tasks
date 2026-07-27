import type { NotificationType } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";
import { deliverNotification } from "@/lib/notifications/deliverNotification";

export type FanoutListItemCompletedParams = {
  /** Source workspace id for the list_items row. */
  workspaceId: string;
  listId: string;
  listItemId: string;
  itemText: string;
  listTitle: string;
  completedAt?: string | null;
  actorUserId?: string | null;
  supabase?: any;
};

type MemberProfileRow = {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    notification_prefs: unknown;
  } | null;
};

const NOTIFICATION_TYPE: NotificationType = "activity";

function resolveActorName(
  actorUserId: string | null | undefined,
  members: MemberProfileRow[],
): string {
  if (!actorUserId) return "Someone";
  const row = members.find((m) => m.user_id === actorUserId);
  const name = row?.profiles?.full_name?.trim();
  if (name) return name;
  const email = row?.profiles?.email?.trim();
  if (email) return email.split("@")[0] || "Someone";
  return "Someone";
}

function truncateLabel(value: string, max = 80): string {
  const trimmed = value.trim() || "Untitled";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function fetchWorkspaceMembers(
  supabase: any,
  workspaceId: string,
): Promise<MemberProfileRow[]> {
  let result = await supabase
    .from("workspace_members")
    .select("user_id, profiles(full_name, email, notification_prefs)")
    .eq("workspace_id", workspaceId);

  if (result.error && isMissingNotificationPrefsColumn(result.error)) {
    warnMissingNotificationPrefsColumnOnce();
    result = await supabase
      .from("workspace_members")
      .select("user_id, profiles(full_name, email)")
      .eq("workspace_id", workspaceId);
  }

  if (result.error) {
    if (isMissingNotificationPrefsColumn(result.error)) {
      warnMissingNotificationPrefsColumnOnce();
      return [];
    }
    logError("fanoutListItemCompleted:members", result.error);
    return [];
  }

  return (result.data ?? []) as MemberProfileRow[];
}

/**
 * Notify workspace teammates (and any active cross-workspace list share collaborators)
 * when someone checks off a list item. Excludes the actor.
 * Safe to call fire-and-forget (.catch(() => {})).
 */
export async function fanoutListItemCompletedNotifications(
  params: FanoutListItemCompletedParams,
): Promise<void> {
  const workspaceId = params.workspaceId?.trim();
  const listId = params.listId?.trim();
  const listItemId = params.listItemId?.trim();
  if (!workspaceId || !listId || !listItemId || ["w1", "w2"].includes(workspaceId)) return;

  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return;

  try {
    // Always include the source workspace; also include linked workspaces when the list is shared.
    const linkedWorkspaceIds = new Set<string>([workspaceId]);

    const { data: shares, error: sharesError } = await supabase
      .from("workspace_list_shares")
      .select("source_workspace_id, target_workspace_id")
      .eq("list_id", listId)
      .is("revoked_at", null);

    if (sharesError) {
      // Shares table may be unavailable — still notify source workspace members.
      logError("fanoutListItemCompleted:shares", sharesError);
    } else {
      const shareRows = (shares ?? []) as Array<{
        source_workspace_id: string;
        target_workspace_id: string;
      }>;
      for (const share of shareRows) {
        if (share.source_workspace_id) linkedWorkspaceIds.add(share.source_workspace_id);
        if (share.target_workspace_id) linkedWorkspaceIds.add(share.target_workspace_id);
      }
    }

    const memberResults = await Promise.all(
      [...linkedWorkspaceIds].map(async (wsId) => ({
        workspaceId: wsId,
        members: await fetchWorkspaceMembers(supabase, wsId),
      })),
    );

    const allMembers: MemberProfileRow[] = [];
    /** Prefer source workspace for inbox scoping when the recipient is a member there. */
    const recipientWorkspace = new Map<string, string>();
    const recipientProfile = new Map<string, MemberProfileRow>();

    // Process source workspace first so teammates land in the completing workspace inbox.
    const ordered = [
      ...memberResults.filter((r) => r.workspaceId === workspaceId),
      ...memberResults.filter((r) => r.workspaceId !== workspaceId),
    ];

    for (const { workspaceId: wsId, members } of ordered) {
      for (const member of members) {
        if (!member.user_id) continue;
        allMembers.push(member);
        if (!recipientWorkspace.has(member.user_id)) {
          recipientWorkspace.set(member.user_id, wsId);
          recipientProfile.set(member.user_id, member);
        }
      }
    }

    const actorUserId = params.actorUserId ?? null;
    if (actorUserId) recipientWorkspace.delete(actorUserId);
    if (recipientWorkspace.size === 0) return;

    const actorName = resolveActorName(actorUserId, allMembers);
    const itemLabel = truncateLabel(params.itemText || "an item");
    const listLabel = truncateLabel(params.listTitle || "list");
    const completedAt = params.completedAt?.trim() || new Date().toISOString();

    const title = "List item completed";
    const message = `${actorName} checked off "${itemLabel}" on ${listLabel}.`;

    await Promise.all(
      [...recipientWorkspace.entries()].map(([recipientId, recipientWsId]) => {
        const member = recipientProfile.get(recipientId);
        return deliverNotification({
          supabase,
          workspaceId: recipientWsId,
          recipientUserId: recipientId,
          type: NOTIFICATION_TYPE,
          title,
          message,
          link: `?view=lists&workspace=${recipientWsId}&highlightList=${listId}`,
          workspaceName: listLabel,
          actorUserId,
          metadata: {
            event: "list_item_completed",
            list_id: listId,
            list_item_id: listItemId,
            list_title: params.listTitle,
            item_text: params.itemText,
            completed_at: completedAt,
            actor_name: actorName,
            source_workspace_id: workspaceId,
          },
          recipientProfile: {
            email: member?.profiles?.email ?? null,
            notification_prefs: member?.profiles?.notification_prefs,
          },
        });
      }),
    );
  } catch (err) {
    logError("fanoutListItemCompleted", err);
  }
}

/**
 * Load list item + list title, then fan out if the list is shared.
 * Used after persist / outbox flush when only the item id is known.
 */
export async function fanoutListItemCompletedById(params: {
  listItemId: string;
  workspaceId: string;
  actorUserId?: string | null;
  supabase?: any;
}): Promise<void> {
  const listItemId = params.listItemId?.trim();
  const workspaceId = params.workspaceId?.trim();
  if (!listItemId || !workspaceId || ["w1", "w2"].includes(workspaceId)) return;

  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) return;

  try {
    const { data: item, error: itemError } = await supabase
      .from("list_items")
      .select("id, list_id, text, completed, completed_at, workspace_id")
      .eq("id", listItemId)
      .maybeSingle();

    if (itemError) {
      logError("fanoutListItemCompletedById:item", itemError);
      return;
    }
    if (!item || !(item as { completed?: boolean }).completed) return;

    const listId = String((item as { list_id?: string }).list_id || "");
    if (!listId) return;

    const { data: list, error: listError } = await supabase
      .from("workspace_lists")
      .select("title")
      .eq("id", listId)
      .maybeSingle();

    if (listError) {
      logError("fanoutListItemCompletedById:list", listError);
    }

    await fanoutListItemCompletedNotifications({
      supabase,
      workspaceId: String((item as { workspace_id?: string }).workspace_id || workspaceId),
      listId,
      listItemId,
      itemText: String((item as { text?: string }).text || ""),
      listTitle: String((list as { title?: string } | null)?.title || "shared list"),
      completedAt: (item as { completed_at?: string | null }).completed_at ?? null,
      actorUserId: params.actorUserId,
    });
  } catch (err) {
    logError("fanoutListItemCompletedById", err);
  }
}
