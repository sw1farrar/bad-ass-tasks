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

/** Read `?workspace=` from the current URL (id, slug, or name). */
export function getPreferredWorkspaceRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = new URLSearchParams(window.location.search).get("workspace");
    const trimmed = value?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/** Match a workspace by id, slug, or name (case-insensitive for slug/name). */
export function findWorkspaceByRef(
  workspaces: Workspace[],
  ref: string | null | undefined
): Workspace | null {
  if (!ref || !workspaces.length) return null;
  const exact = workspaces.find((w) => w.id === ref);
  if (exact) return exact;

  const normalized = ref.trim().toLowerCase();
  if (!normalized) return null;

  return (
    workspaces.find((w) => w.slug?.toLowerCase() === normalized) ||
    workspaces.find((w) => w.name?.trim().toLowerCase() === normalized) ||
    null
  );
}

/** Stable ordering so fallback selection is deterministic across devices. */
export function sortWorkspacesDeterministic(workspaces: Workspace[]): Workspace[] {
  return [...workspaces].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
  });
}

/**
 * Pick workspace priority:
 * 1) current id if still valid (active switch wins over a stale URL)
 * 2) URL / preferred ref when current is empty (PWA bookmarks, invite links)
 * 3) last saved id
 * 4) oldest owned workspace, else oldest membership
 */
export function resolveCurrentWorkspace(
  workspaces: Workspace[],
  options: {
    currentId?: string;
    lastSavedId?: string | null;
    preferredRef?: string | null;
  }
): Workspace | null {
  if (!workspaces.length) return null;

  const ordered = sortWorkspacesDeterministic(workspaces);
  const { currentId, lastSavedId, preferredRef } = options;

  // Keep an active selection (including demo w1/w2). Empty loading placeholder is not valid.
  if (currentId) {
    const still = ordered.find((w) => w.id === currentId);
    if (still) return still;
  }

  if (preferredRef) {
    const preferred = findWorkspaceByRef(ordered, preferredRef);
    if (preferred) return preferred;
  }

  if (lastSavedId) {
    const saved = ordered.find((w) => w.id === lastSavedId);
    if (saved) return saved;
  }

  const owned = ordered.find((w) => w.role === "owner");
  return owned ?? ordered[0];
}

/** Canonical URL value for a workspace — prefer slug for readable bookmarks. */
export function workspaceUrlRef(workspace: Pick<Workspace, "id" | "slug">): string {
  const slug = workspace.slug?.trim();
  return slug || workspace.id;
}
