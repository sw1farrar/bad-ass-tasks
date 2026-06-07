import type { Workspace } from "@/types";

const DEMO_PRIMARY_WORKSPACE_ID = "w1";

/** The user's original/bootstrap workspace — oldest owned workspace, or demo w1. */
export function getPrimaryWorkspace(
  workspaces: Workspace[],
  userId?: string | null
): Workspace | null {
  if (!workspaces.length) return null;

  const isDemo = workspaces.some((w) => w.id === "w1" || w.id === "w2");
  if (isDemo) {
    return workspaces.find((w) => w.id === DEMO_PRIMARY_WORKSPACE_ID) ?? workspaces[0];
  }

  const owned = workspaces.filter((w) => {
    if (w.role !== "owner") return false;
    if (userId && w.owner_id) return w.owner_id === userId;
    return true;
  });

  const candidates = owned.length ? owned : workspaces.filter((w) => w.role === "owner");
  if (!candidates.length) return workspaces[0];

  return candidates.reduce((oldest, w) => {
    if (!oldest.createdAt) return w.createdAt ? w : oldest;
    if (!w.createdAt) return oldest;
    return w.createdAt < oldest.createdAt ? w : oldest;
  });
}

export function canDeleteWorkspace(
  workspaceId: string,
  workspaces: Workspace[],
  userId?: string | null
): { allowed: boolean; reason?: string } {
  if (!workspaceId) {
    return { allowed: false, reason: "No workspace selected." };
  }

  if (workspaces.length <= 1) {
    return {
      allowed: false,
      reason: "This is your only workspace. Create another workspace before you can delete this one.",
    };
  }

  const primary = getPrimaryWorkspace(workspaces, userId);
  if (primary?.id === workspaceId) {
    return {
      allowed: false,
      reason: "Your original workspace is permanent and cannot be deleted.",
    };
  }

  const target = workspaces.find((w) => w.id === workspaceId);
  if (!target || target.role !== "owner") {
    return { allowed: false, reason: "Only the workspace owner can delete it." };
  }

  return { allowed: true };
}

/** Prefer the original workspace when switching after a delete; otherwise first remaining. */
export function getWorkspaceSwitchTargetAfterDelete(
  remaining: Workspace[],
  userId?: string | null
): Workspace | null {
  if (!remaining.length) return null;
  return getPrimaryWorkspace(remaining, userId) ?? remaining[0];
}