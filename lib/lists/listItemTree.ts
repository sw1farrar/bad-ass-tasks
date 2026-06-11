import type { ListItem } from "@/types";

export const LIST_ITEM_PREVIEW_LIMIT = 10;

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
      walk(child.id, depth + 1);
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

export function getPreviousSibling(itemId: string, items: ListItem[]): ListItem | undefined {
  const siblings = getListItemSiblings(itemId, items);
  const index = siblings.findIndex((i) => i.id === itemId);
  if (index <= 0) return undefined;
  return siblings[index - 1];
}

function isDescendantOf(itemId: string, ancestorId: string, items: ListItem[]): boolean {
  let current = items.find((i) => i.id === itemId);
  const visited = new Set<string>();

  while (current?.parentItemId) {
    const parentItemId = current.parentItemId;
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (parentItemId === ancestorId) return true;
    const parent = items.find((i) => i.id === parentItemId);
    if (!parent) break;
    current = parent;
  }

  return false;
}

function wouldCreateCycle(itemId: string, newParentId: string, items: ListItem[]): boolean {
  return itemId === newParentId || isDescendantOf(newParentId, itemId, items);
}

export function getIndentParentId(itemId: string, items: ListItem[]): string | undefined {
  const item = items.find((i) => i.id === itemId);
  if (!item) return undefined;

  const prevSibling = getPreviousSibling(itemId, items);
  if (prevSibling && !wouldCreateCycle(itemId, prevSibling.id, items)) {
    return prevSibling.id;
  }

  const previousFlat = getPreviousFlatSibling(itemId, items);
  if (!previousFlat) return undefined;

  if (
    item.parentItemId !== previousFlat.id &&
    !wouldCreateCycle(itemId, previousFlat.id, items)
  ) {
    return previousFlat.id;
  }

  const flat = flattenListItems(items);
  const itemIndex = flat.findIndex((i) => i.id === itemId);
  for (let i = itemIndex - 1; i >= 0; i--) {
    const candidate = flat[i];
    if (candidate.id === previousFlat.id) break;
    if (
      isDescendantOf(candidate.id, previousFlat.id, items) &&
      candidate.id !== itemId &&
      !wouldCreateCycle(itemId, candidate.id, items)
    ) {
      return candidate.id;
    }
  }

  return undefined;
}

export function canIndentListItem(itemId: string, items: ListItem[]): boolean {
  return getIndentParentId(itemId, items) !== undefined;
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

export type OutdentListItemUpdate = {
  parentItemId: string | null;
  sortOrder: number;
  /** Renormalized sort orders for every sibling at the target parent (including the moved item). */
  siblingSortOrders: Map<string, number>;
};

/**
 * Outdent while preserving flat-list position: the item becomes a sibling of its
 * parent, inserted immediately after the parent — never appended to the list tail.
 */
export function computeOutdentUpdate(
  items: ListItem[],
  itemId: string,
): OutdentListItemUpdate | null {
  const item = items.find((i) => i.id === itemId);
  if (!item?.parentItemId) return null;

  const newParentId = getOutdentParentId(itemId, items);
  if (newParentId === undefined) return null;

  const parentId = item.parentItemId;
  const siblings = items
    .filter(
      (i) =>
        i.listId === item.listId &&
        (i.parentItemId ?? null) === (newParentId ?? null) &&
        i.id !== itemId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const parentIndex = siblings.findIndex((s) => s.id === parentId);
  if (parentIndex < 0) return null;

  const reordered = [...siblings];
  reordered.splice(parentIndex + 1, 0, {
    ...item,
    parentItemId: newParentId ?? undefined,
  });

  const siblingSortOrders = new Map<string, number>();
  reordered.forEach((sibling, index) => {
    siblingSortOrders.set(sibling.id, index * 1000);
  });

  const moved = siblingSortOrders.get(itemId);
  if (moved === undefined) return null;

  return {
    parentItemId: newParentId,
    sortOrder: moved,
    siblingSortOrders,
  };
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