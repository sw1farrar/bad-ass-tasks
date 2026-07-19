import type { ListItem } from "@/types";

export type ListItemPlacementUpdate = {
  sortOrder: number;
  parentItemId?: string | null;
};

const persistChains = new Map<string, Promise<void>>();
const pendingReorderDepth = new Map<string, number>();
const lastPersistedPlacement = new Map<string, ListItemPlacementUpdate>();

function placementKey(sortOrder: number, parentItemId: string | null | undefined): string {
  return `${sortOrder}:${parentItemId ?? ""}`;
}

export function hasPendingListItemReorder(listId: string): boolean {
  return (pendingReorderDepth.get(listId) ?? 0) > 0;
}

export function notePersistedListItemPlacement(
  itemId: string,
  update: ListItemPlacementUpdate,
): void {
  lastPersistedPlacement.set(itemId, {
    sortOrder: update.sortOrder,
    parentItemId: update.parentItemId ?? null,
  });
}

/** Serialize reorder writes per list so rapid nudges persist in order. */
export function enqueueListReorderPersist(
  listId: string,
  persist: () => Promise<void>,
): void {
  pendingReorderDepth.set(listId, (pendingReorderDepth.get(listId) ?? 0) + 1);

  const chain = persistChains.get(listId) ?? Promise.resolve();
  const next = chain
    .then(persist)
    .catch(() => {})
    .finally(() => {
      const depth = (pendingReorderDepth.get(listId) ?? 1) - 1;
      if (depth <= 0) pendingReorderDepth.delete(listId);
      else pendingReorderDepth.set(listId, depth);
    });

  persistChains.set(listId, next);
  void next.finally(() => {
    if (persistChains.get(listId) === next) {
      persistChains.delete(listId);
    }
  });
}

const pendingChecklistSyncIds = new Set<string>();

/** Mark checklist fields (completed/pending) as syncing so hydrate cannot clobber them. */
export function beginListItemChecklistSync(itemId: string): void {
  pendingChecklistSyncIds.add(itemId);
}

export function endListItemChecklistSync(itemId: string): void {
  pendingChecklistSyncIds.delete(itemId);
}

export function hasPendingListItemChecklistSync(itemId: string): boolean {
  return pendingChecklistSyncIds.has(itemId);
}

function preferLocalChecklistFields(local: ListItem, remote: ListItem): ListItem {
  return {
    ...local,
    ...remote,
    completed: local.completed,
    completedAt: local.completedAt,
    pending: local.pending,
    updatedAt: local.updatedAt,
  };
}

/** Prefer optimistic placement while reorders are in flight or a stale remote event arrives. */
export function mergeRemoteListItemUpdate(local: ListItem, remote: ListItem): ListItem {
  if (hasPendingListItemReorder(local.listId)) {
    const merged = preferLocalChecklistFields(local, remote);
    return {
      ...merged,
      sortOrder: local.sortOrder,
      parentItemId: local.parentItemId,
      updatedAt: local.updatedAt,
    };
  }

  const last = lastPersistedPlacement.get(local.id);
  const localParent = local.parentItemId ?? null;
  const remoteParent = remote.parentItemId ?? null;

  if (
    last &&
    placementKey(local.sortOrder, localParent) === placementKey(last.sortOrder, last.parentItemId) &&
    placementKey(remote.sortOrder, remoteParent) !== placementKey(last.sortOrder, last.parentItemId)
  ) {
    const merged = preferLocalChecklistFields(local, remote);
    return {
      ...merged,
      sortOrder: local.sortOrder,
      parentItemId: local.parentItemId,
      updatedAt: local.updatedAt,
    };
  }

  // Keep optimistic checklist state while a write is in flight, or when local checklist
  // fields are newer than remote (covers mobile kills: durable outbox + hydrate race).
  const localTs = Date.parse(local.updatedAt || "") || 0;
  const remoteTs = Date.parse(remote.updatedAt || "") || 0;
  const checklistDiffers =
    local.completed !== remote.completed ||
    !!local.pending !== !!remote.pending ||
    (local.completedAt ?? null) !== (remote.completedAt ?? null);
  if (
    hasPendingListItemChecklistSync(local.id) ||
    (checklistDiffers && localTs > remoteTs)
  ) {
    const merged = preferLocalChecklistFields(local, remote);
    lastPersistedPlacement.set(local.id, {
      sortOrder: merged.sortOrder,
      parentItemId: merged.parentItemId ?? null,
    });
    return merged;
  }

  const merged = { ...local, ...remote };
  lastPersistedPlacement.set(local.id, {
    sortOrder: merged.sortOrder,
    parentItemId: merged.parentItemId ?? null,
  });
  return merged;
}