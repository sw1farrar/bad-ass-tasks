import type { ListItem } from "@/types";

export const LIST_ITEM_PREVIEW_LIMIT = 10;
export const MAX_LIST_ITEM_DEPTH = 3;

export type FlatListItem = ListItem & { depth: number };

function groupByParent(items: ListItem[]): Map<string | null, ListItem[]> {
  const byParent = new Map<string | null, ListItem[]>();
  for (const item of items) {
    const key = item.parentItemId ?? null;
    const group = byParent.get(key);
    if (group) group.push(item);
    else byParent.set(key, [item]);
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return byParent;
}

export function getListItemDepth(itemId: string, items: ListItem[]): number {
  const byId = new Map(items.map((i) => [i.id, i]));
  let depth = 0;
  let current = byId.get(itemId);
  const visited = new Set<string>();

  while (current?.parentItemId) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    depth += 1;
    current = byId.get(current.parentItemId);
    if (depth >= MAX_LIST_ITEM_DEPTH) break;
  }

  return depth;
}

/** Pre-order tree walk: parents before children, siblings by sort_order. */
export function flattenListItems(items: ListItem[]): FlatListItem[] {
  const byParent = groupByParent(items);
  const result: FlatListItem[] = [];

  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      result.push({ ...child, depth });
      if (depth + 1 < MAX_LIST_ITEM_DEPTH) {
        walk(child.id, depth + 1);
      }
    }
  };

  walk(null, 0);
  return result;
}

export function getListItemSiblings(itemId: string, items: ListItem[]): ListItem[] {
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];
  const parentKey = item.parentItemId ?? null;
  return items
    .filter((i) => (i.parentItemId ?? null) === parentKey)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPreviousFlatSibling(itemId: string, items: ListItem[]): ListItem | undefined {
  const flat = flattenListItems(items);
  const index = flat.findIndex((i) => i.id === itemId);
  if (index <= 0) return undefined;
  return flat[index - 1];
}

export function canIndentListItem(itemId: string, items: ListItem[]): boolean {
  const item = items.find((i) => i.id === itemId);
  if (!item) return false;

  const previous = getPreviousFlatSibling(itemId, items);
  if (!previous) return false;

  const newDepth = getListItemDepth(previous.id, items) + 1;
  return newDepth < MAX_LIST_ITEM_DEPTH;
}

export function getIndentParentId(itemId: string, items: ListItem[]): string | null | undefined {
  if (!canIndentListItem(itemId, items)) return undefined;
  const previous = getPreviousFlatSibling(itemId, items);
  return previous?.id ?? undefined;
}

export function canOutdentListItem(itemId: string, items: ListItem[]): boolean {
  const item = items.find((i) => i.id === itemId);
  return !!item?.parentItemId;
}

export function getOutdentParentId(itemId: string, items: ListItem[]): string | null | undefined {
  const item = items.find((i) => i.id === itemId);
  if (!item?.parentItemId) return undefined;
  const parent = items.find((i) => i.id === item.parentItemId);
  return parent?.parentItemId ?? null;
}

export function nextSortOrderAmongSiblings(
  items: ListItem[],
  listId: string,
  parentItemId: string | null | undefined,
): number {
  const siblings = items.filter(
    (i) =>
      i.listId === listId &&
      (i.parentItemId ?? null) === (parentItemId ?? null),
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((i) => i.sortOrder)) + 1000;
}

export type InsertAfterListItemPlacement = {
  parentItemId: string | null;
  sortOrder: number;
};

/** Place a new sibling directly after an existing item (same parent). */
export function sortOrderForInsertAfter(
  items: ListItem[],
  afterItemId: string,
): InsertAfterListItemPlacement | null {
  const after = items.find((i) => i.id === afterItemId);
  if (!after) return null;

  const parentItemId = after.parentItemId ?? null;
  const siblings = items
    .filter(
      (i) =>
        i.listId === after.listId &&
        (i.parentItemId ?? null) === parentItemId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const index = siblings.findIndex((i) => i.id === afterItemId);
  if (index < 0) return null;

  const next = siblings[index + 1];
  if (!next) {
    return { parentItemId, sortOrder: after.sortOrder + 1000 };
  }

  const gap = next.sortOrder - after.sortOrder;
  if (gap <= 1) {
    return { parentItemId, sortOrder: after.sortOrder + 1 };
  }

  return { parentItemId, sortOrder: Math.floor((after.sortOrder + next.sortOrder) / 2) };
}