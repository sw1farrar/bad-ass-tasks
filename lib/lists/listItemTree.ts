import type { ListItem } from "@/types";

export const LIST_ITEM_PREVIEW_LIMIT = 10;

/** Maximum indent depth (0 = top-level, 2 = two levels nested). */
export const LIST_ITEM_MAX_DEPTH = 2;

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

  // Orphans (missing parent in set) still render — never vanish from the UI.
  const reached = new Set(result.map((row) => row.id));
  for (const orphan of items) {
    if (!reached.has(orphan.id)) {
      result.push({ ...orphan, depth: 0 });
    }
  }

  return result;
}

export type ListItemFamily = {
  rootId: string;
  items: FlatListItem[];
};

/** Group a pre-order flat list into visual families (root row + nested descendants). */
export function groupFlatListItemsIntoFamilies(flatItems: FlatListItem[]): ListItemFamily[] {
  const families: ListItemFamily[] = [];
  let current: FlatListItem[] = [];

  const flush = () => {
    if (current.length === 0) return;
    families.push({ rootId: current[0].id, items: current });
    current = [];
  };

  for (const item of flatItems) {
    if (item.depth === 0) {
      flush();
      current = [item];
      continue;
    }

    if (current.length === 0) {
      current = [item];
      continue;
    }

    current.push(item);
  }

  flush();
  return families;
}

/** Root row id for the visual family that contains `itemId` in a pre-order flat list. */
export function getFamilyRootIdForFlatItem(
  flatItems: FlatListItem[],
  itemId: string,
): string | undefined {
  const index = flatItems.findIndex((row) => row.id === itemId);
  if (index < 0) return undefined;

  for (let i = index; i >= 0; i--) {
    if (flatItems[i].depth === 0) return flatItems[i].id;
  }

  return flatItems[index].id;
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

/** Nearest row at `targetDepth` above `fromIndex` in the flat list (outliner parent). */
function findParentAtDepth(
  flat: FlatListItem[],
  fromIndex: number,
  targetDepth: number,
  activeId: string,
  items: ListItem[],
): string | null {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (flat[i].depth !== targetDepth) continue;
    const candidate = flat[i].id;
    if (!wouldCreateCycle(activeId, candidate, items)) return candidate;
  }
  return null;
}

/**
 * Indent exactly one level: parent is the nearest row above at the item's current
 * depth (not the immediately previous row when that would skip a level).
 */
export function getIndentParentId(itemId: string, items: ListItem[]): string | undefined {
  const item = items.find((i) => i.id === itemId);
  if (!item) return undefined;

  const flat = flattenListItems(items);
  const index = flat.findIndex((row) => row.id === itemId);
  if (index <= 0) return undefined;

  const currentDepth = flat[index].depth;
  const parentId = findParentAtDepth(flat, index, currentDepth, itemId, items);
  if (!parentId) return undefined;

  const parent = items.find((i) => i.id === parentId);
  if (!parent || parent.listId !== item.listId) return undefined;

  return parentId;
}

function canIndentListItemDirect(itemId: string, items: ListItem[]): boolean {
  const parentId = getIndentParentId(itemId, items);
  if (!parentId) return false;

  const item = items.find((i) => i.id === itemId);
  if (item?.parentItemId === parentId) return false;

  return getListItemDepth(parentId, items) + 1 <= LIST_ITEM_MAX_DEPTH;
}

export function canIndentListItem(itemId: string, items: ListItem[]): boolean {
  if (getListItemDepth(itemId, items) >= LIST_ITEM_MAX_DEPTH) return false;
  return canIndentListItemDirect(itemId, items);
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

export type ListItemTreeUpdate = {
  parentItemId: string | null | undefined;
  sortOrder: number;
};

/** Deepest nesting below `itemId` (0 = leaf, 1 = has direct children, etc.). */
export function getSubtreeMaxRelativeDepth(itemId: string, items: ListItem[]): number {
  const flat = flattenListItems(items);
  const start = flat.findIndex((row) => row.id === itemId);
  if (start < 0) return 0;
  const rootDepth = flat[start].depth;
  let maxRelative = 0;
  for (let i = start + 1; i < flat.length; i++) {
    if (flat[i].depth <= rootDepth) break;
    maxRelative = Math.max(maxRelative, flat[i].depth - rootDepth);
  }
  return maxRelative;
}

function scopeItemsToList(itemId: string, items: ListItem[]): ListItem[] {
  const listId = items.find((i) => i.id === itemId)?.listId;
  return listId ? items.filter((i) => i.listId === listId) : items;
}

/** True when `itemId` has open nested items below it. */
export function hasIncompleteDescendants(itemId: string, items: ListItem[]): boolean {
  const scoped = scopeItemsToList(itemId, items);
  const subtreeIds = getSubtreeFlatIds(itemId, scoped);
  return scoped.some((i) => subtreeIds.includes(i.id) && i.id !== itemId && !i.completed);
}

/** Open items in the subtree rooted at `itemId` (pre-order, includes the root). */
export function getIncompleteSubtreeItems(itemId: string, items: ListItem[]): ListItem[] {
  const scoped = scopeItemsToList(itemId, items);
  const subtreeIds = new Set(getSubtreeFlatIds(itemId, scoped));
  return flattenListItems(scoped)
    .filter((row) => subtreeIds.has(row.id))
    .map((row) => scoped.find((i) => i.id === row.id)!)
    .filter((i) => !i.completed);
}

/** Subtree rooted at itemId in flat pre-order (item + all descendants). */
export function getSubtreeFlatIds(itemId: string, items: ListItem[]): string[] {
  const flat = flattenListItems(items);
  const start = flat.findIndex((row) => row.id === itemId);
  if (start < 0) return [];
  const rootDepth = flat[start].depth;
  const ids = [itemId];
  for (let i = start + 1; i < flat.length; i++) {
    if (flat[i].depth <= rootDepth) break;
    ids.push(flat[i].id);
  }
  return ids;
}

function assignSortOrdersFromFlat(flat: FlatListItem[], items: ListItem[]): Map<string, number> {
  const byParent = new Map<string | null, ListItem[]>();
  for (const row of flat) {
    const item = items.find((i) => i.id === row.id);
    if (!item) continue;
    const parent = item.parentItemId ?? null;
    const group = byParent.get(parent);
    if (group) group.push(item);
    else byParent.set(parent, [item]);
  }

  const sortOrders = new Map<string, number>();
  for (const siblings of byParent.values()) {
    siblings.forEach((sibling, index) => {
      sortOrders.set(sibling.id, index * 1000);
    });
  }
  return sortOrders;
}

export type FlatListReorderResult = {
  updates: Map<string, ListItemTreeUpdate>;
};

type FlatDragInsertPosition = {
  insertIdx: number;
  newFlat: FlatListItem[];
  newParentId: string | null;
};

/** Parent implied by the gap between rows in `newFlat` (no drop-target guessing). */
function resolveParentForPositionalInsert(
  newFlat: FlatListItem[],
  insertIdx: number,
  blockLength: number,
  activeDepth: number,
  activeId: string,
  items: ListItem[],
): string | null {
  const rowBefore = insertIdx > 0 ? newFlat[insertIdx - 1] : null;
  const rowAfter = newFlat[insertIdx + blockLength] ?? null;

  if (activeDepth > 0) {
    return findParentAtDepth(newFlat, insertIdx, activeDepth - 1, activeId, items);
  }

  if (
    rowBefore &&
    rowAfter &&
    rowBefore.depth < rowAfter.depth &&
    !wouldCreateCycle(activeId, rowBefore.id, items)
  ) {
    return rowBefore.id;
  }

  return null;
}

function assignSortOrdersFollowingFlat(
  flat: FlatListItem[],
  items: ListItem[],
): Map<string, number> {
  const counters = new Map<string | null, number>();
  const sortOrders = new Map<string, number>();

  for (const row of flat) {
    const item = items.find((i) => i.id === row.id);
    if (!item) continue;
    const parent = item.parentItemId ?? null;
    const index = counters.get(parent) ?? 0;
    sortOrders.set(row.id, index * 1000);
    counters.set(parent, index + 1);
  }

  return sortOrders;
}

/** Positional insert — preview gap and commit use the same flat index. */
function computeFlatDragInsertPosition(
  items: ListItem[],
  activeId: string,
  overId: string,
  insertAfterOver = false,
): FlatDragInsertPosition | null {
  const flat = flattenListItems(items);
  const activeIdx = flat.findIndex((row) => row.id === activeId);
  const overIdx = flat.findIndex((row) => row.id === overId);
  if (activeIdx < 0 || overIdx < 0 || activeIdx === overIdx) return null;

  const blockIds = getSubtreeFlatIds(activeId, items);
  if (blockIds.includes(overId)) return null;

  const activeDepth = flat[activeIdx].depth;
  const block = flat.filter((row) => blockIds.includes(row.id));
  const reduced = flat.filter((row) => !blockIds.includes(row.id));
  let insertIdx = reduced.findIndex((row) => row.id === overId);
  if (insertIdx < 0) return null;
  if (insertAfterOver) insertIdx += 1;

  const newFlat: FlatListItem[] = [
    ...reduced.slice(0, insertIdx),
    ...block,
    ...reduced.slice(insertIdx),
  ];

  const newParentId = resolveParentForPositionalInsert(
    newFlat,
    insertIdx,
    block.length,
    activeDepth,
    activeId,
    items,
  );

  return {
    insertIdx,
    newFlat,
    newParentId,
  };
}

/**
 * Reorder by flat list position — moves the dragged subtree to the gap shown
 * while dragging. Top-level items stay top-level; nested items keep their depth.
 */
export function computeFlatListReorder(
  items: ListItem[],
  activeId: string,
  overId: string,
  insertAfterOver = false,
): FlatListReorderResult | null {
  const position = computeFlatDragInsertPosition(items, activeId, overId, insertAfterOver);
  if (!position) return null;

  const { newFlat, newParentId } = position;
  const nextItems = items.map((row) =>
    row.id === activeId
      ? { ...row, parentItemId: newParentId ?? undefined }
      : row,
  );

  const sortOrders = assignSortOrdersFollowingFlat(newFlat, nextItems);
  const updates = new Map<string, ListItemTreeUpdate>();
  for (const [id, sortOrder] of sortOrders) {
    const row = nextItems.find((i) => i.id === id);
    if (!row) continue;
    updates.set(id, {
      parentItemId: id === activeId ? newParentId : (row.parentItemId ?? null),
      sortOrder,
    });
  }

  return { updates };
}

export type ListNudgeDirection = "up" | "down";

/** Neighbors for one-step reorder within an optional visible subset of the flat list. */
export function getFlatListNudgeTargets(
  items: ListItem[],
  itemId: string,
  visibleItemIds?: ReadonlySet<string>,
): {
  canMoveUp: boolean;
  canMoveDown: boolean;
  upOverId: string | null;
  downOverId: string | null;
} {
  const fullFlat = flattenListItems(items);
  const active = fullFlat.find((row) => row.id === itemId);
  if (!active) {
    return { canMoveUp: false, canMoveDown: false, upOverId: null, downOverId: null };
  }

  // Top-level parents move as complete families. Targeting the immediately
  // preceding flat row would target the previous parent's last child and could
  // split or nest the families instead of swapping them.
  if (active.depth === 0) {
    const visibleRoots = fullFlat.filter(
      (row) => row.depth === 0 && (!visibleItemIds || visibleItemIds.has(row.id)),
    );
    const rootIndex = visibleRoots.findIndex((row) => row.id === itemId);
    if (rootIndex < 0) {
      return { canMoveUp: false, canMoveDown: false, upOverId: null, downOverId: null };
    }

    const previousRoot = visibleRoots[rootIndex - 1];
    const nextRoot = visibleRoots[rootIndex + 1];
    const nextFamilyIds = nextRoot ? getSubtreeFlatIds(nextRoot.id, items) : [];
    const downOverId = nextFamilyIds.at(-1) ?? null;
    const upOverId = previousRoot?.id ?? null;

    return {
      canMoveUp: upOverId !== null,
      canMoveDown: downOverId !== null,
      upOverId,
      downOverId,
    };
  }

  let flat = fullFlat;
  if (visibleItemIds && visibleItemIds.size > 0) {
    flat = flat.filter((row) => visibleItemIds.has(row.id));
  }

  const startIdx = flat.findIndex((row) => row.id === itemId);
  if (startIdx < 0) {
    return { canMoveUp: false, canMoveDown: false, upOverId: null, downOverId: null };
  }

  const blockIds = new Set(getSubtreeFlatIds(itemId, items));
  let blockEnd = startIdx;
  while (blockEnd + 1 < flat.length && blockIds.has(flat[blockEnd + 1].id)) {
    blockEnd += 1;
  }

  const upOverId = startIdx > 0 ? flat[startIdx - 1].id : null;
  const downOverId = blockEnd < flat.length - 1 ? flat[blockEnd + 1].id : null;

  return {
    canMoveUp: upOverId !== null,
    canMoveDown: downOverId !== null,
    upOverId,
    downOverId,
  };
}

/** Move an item (and its subtree) one row up or down in the flat list. */
export function computeFlatListNudge(
  items: ListItem[],
  itemId: string,
  direction: ListNudgeDirection,
  visibleItemIds?: ReadonlySet<string>,
): FlatListReorderResult | null {
  const targets = getFlatListNudgeTargets(items, itemId, visibleItemIds);
  if (direction === "up") {
    if (!targets.upOverId) return null;
    return computeFlatListReorder(items, itemId, targets.upOverId, false);
  }
  if (!targets.downOverId) return null;
  return computeFlatListReorder(items, itemId, targets.downOverId, true);
}

export type IndentListItemUpdate = {
  parentItemId: string;
  sortOrder: number;
  siblingSortOrders: Map<string, number>;
};

/** Indent one level under the nearest valid parent row above. */
export function computeIndentUpdate(
  items: ListItem[],
  itemId: string,
): IndentListItemUpdate | null {
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  if (getListItemDepth(itemId, items) >= LIST_ITEM_MAX_DEPTH) return null;

  const parentId = getIndentParentId(itemId, items);
  if (!parentId || parentId === item.parentItemId) return null;

  const parent = items.find((i) => i.id === parentId);
  if (!parent || parent.listId !== item.listId) return null;
  if (getListItemDepth(parentId, items) + 1 > LIST_ITEM_MAX_DEPTH) return null;

  const siblings = items
    .filter(
      (i) =>
        i.listId === item.listId &&
        (i.parentItemId ?? null) === parentId &&
        i.id !== itemId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const reordered = [{ ...item, parentItemId: parentId }, ...siblings];
  const siblingSortOrders = new Map<string, number>();
  reordered.forEach((sibling, index) => {
    siblingSortOrders.set(sibling.id, index * 1000);
  });

  const movedSort = siblingSortOrders.get(itemId);
  if (movedSort === undefined) return null;

  return {
    parentItemId: parentId,
    sortOrder: movedSort,
    siblingSortOrders,
  };
}

/** Sort order for a new sibling inserted at the top of its group. */
export function firstSortOrderAmongSiblings(
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
  const min = Math.min(...siblings.map((i) => i.sortOrder));
  return min - 1000;
}

/** @deprecated Use firstSortOrderAmongSiblings — new items belong at the top. */
export function nextSortOrderAmongSiblings(
  items: ListItem[],
  listId: string,
  parentItemId: string | null | undefined,
): number {
  return firstSortOrderAmongSiblings(items, listId, parentItemId);
}

export type InsertAfterListItemPlacement = {
  parentItemId: string | null;
  sortOrder: number;
  /**
   * When the sibling gap is too tight for a unique midpoint, existing siblings
   * are reindexed to `index * 1000` (new item order is also in that series).
   * Keys are existing item ids only — the new row is not included.
   */
  siblingSortOrders?: Map<string, number>;
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
  if (gap > 1) {
    return {
      parentItemId,
      sortOrder: Math.floor((after.sortOrder + next.sortOrder) / 2),
    };
  }

  // No unique integer between after and next — rebalance the whole sibling group
  // with a slot for the new item immediately after `after`.
  const siblingSortOrders = new Map<string, number>();
  let newSortOrder = 0;
  let orderIndex = 0;
  for (let i = 0; i < siblings.length; i++) {
    siblingSortOrders.set(siblings[i].id, orderIndex * 1000);
    orderIndex += 1;
    if (i === index) {
      newSortOrder = orderIndex * 1000;
      orderIndex += 1;
    }
  }

  return { parentItemId, sortOrder: newSortOrder, siblingSortOrders };
}

export type MoveListSubtreeUpdate = {
  listId: string;
  parentItemId: string | null | undefined;
  sortOrder: number;
};

function maxTopLevelSortOrder(items: ListItem[], listId: string): number {
  return items
    .filter((row) => row.listId === listId && !(row.parentItemId ?? null))
    .reduce((max, row) => Math.max(max, row.sortOrder), -1000);
}

/** Move a row and its descendants to another list (root becomes top-level at the tail). */
export function computeMoveListSubtreeToList(
  items: ListItem[],
  itemId: string,
  targetListId: string,
): Map<string, MoveListSubtreeUpdate> | null {
  const root = items.find((row) => row.id === itemId);
  if (!root || root.listId === targetListId) return null;

  const subtreeIds = getSubtreeFlatIds(itemId, items);
  const rootSortOrder = maxTopLevelSortOrder(items, targetListId) + 1000;
  const updates = new Map<string, MoveListSubtreeUpdate>();

  for (const id of subtreeIds) {
    const row = items.find((item) => item.id === id);
    if (!row) continue;

    if (id === itemId) {
      updates.set(id, {
        listId: targetListId,
        parentItemId: undefined,
        sortOrder: rootSortOrder,
      });
      continue;
    }

    updates.set(id, {
      listId: targetListId,
      parentItemId: row.parentItemId ?? null,
      sortOrder: row.sortOrder,
    });
  }

  return updates;
}