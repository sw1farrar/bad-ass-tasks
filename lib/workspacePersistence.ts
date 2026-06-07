import type { Workspace } from "@/types";

export const LAST_WORKSPACE_KEY_PREFIX = "badazz_last_workspace_id";

export function lastWorkspaceStorageKey(userId: string): string {
  return `${LAST_WORKSPACE_KEY_PREFIX}_${userId}`;
}

export function saveLastWorkspaceId(
  userId: string | null | undefined,
  workspaceId: string
): void {
  if (!userId || !workspaceId) return;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(lastWorkspaceStorageKey(userId), workspaceId);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function getLastWorkspaceId(
  userId: string | null | undefined
): string | null {
  if (!userId) return null;
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(lastWorkspaceStorageKey(userId));
  } catch {
    return null;
  }
}

/** Pick workspace: keep current if still valid, else last saved, else first in list. */
export function resolveCurrentWorkspace(
  workspaces: Workspace[],
  options: { currentId?: string; lastSavedId?: string | null }
): Workspace | null {
  if (!workspaces.length) return null;

  const { currentId, lastSavedId } = options;

  if (currentId) {
    const still = workspaces.find((w) => w.id === currentId);
    if (still) return still;
  }

  if (lastSavedId) {
    const saved = workspaces.find((w) => w.id === lastSavedId);
    if (saved) return saved;
  }

  return workspaces[0];
}