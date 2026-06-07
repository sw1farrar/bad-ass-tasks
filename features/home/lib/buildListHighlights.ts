import type { HomeListHighlight, ListItem, WorkspaceList } from "@/types";

export function buildListHighlightsForWorkspace(
  lists: WorkspaceList[],
  items: ListItem[],
  workspaceId: string,
  workspaceName: string,
): HomeListHighlight[] {
  return lists
    .filter((l) => l.workspaceId === workspaceId)
    .map((list) => {
      const listItems = items.filter((i) => i.listId === list.id && i.workspaceId === workspaceId);
      const open = listItems.filter((i) => !i.completed);
      return {
        id: list.id,
        title: list.title,
        color: list.color,
        workspaceId,
        workspaceName,
        openCount: open.length,
        totalCount: listItems.length,
        preview: open
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 3)
          .map((i) => i.text),
        pinned: list.pinned,
      };
    });
}

export function computeWorkspaceListStats(
  lists: WorkspaceList[],
  items: ListItem[],
  workspaceId: string,
): { listCount: number; openListItemsCount: number } {
  const listCount = lists.filter((l) => l.workspaceId === workspaceId).length;
  const openListItemsCount = items.filter(
    (i) => i.workspaceId === workspaceId && !i.completed,
  ).length;
  return { listCount, openListItemsCount };
}

/** Upsert lists/items from home aggregate fetches without wiping other workspaces. */
export function mergeWorkspaceLists(
  existing: WorkspaceList[],
  incoming: WorkspaceList[],
): WorkspaceList[] {
  const map = new Map(existing.map((l) => [`${l.workspaceId}:${l.id}`, l]));
  for (const list of incoming) {
    map.set(`${list.workspaceId}:${list.id}`, list);
  }
  return [...map.values()];
}

export function mergeListItems(existing: ListItem[], incoming: ListItem[]): ListItem[] {
  const map = new Map(existing.map((i) => [i.id, i]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

/** Pinned + open items first, then by open count — cap for Home hub. */
export function pickGlobalListHighlights(
  all: HomeListHighlight[],
  limit = 6,
): HomeListHighlight[] {
  return [...all]
    .filter((l) => l.openCount > 0 || l.pinned)
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}