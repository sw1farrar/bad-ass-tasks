import type { FlatListItem } from "@/lib/lists/listItemTree";
import { groupFlatListItemsIntoFamilies } from "@/lib/lists/listItemTree";

export type ListItemFamilyChrome = {
  familyRootId: string;
  isFamilyRoot: boolean;
  isFamilyLast: boolean;
  isSoloFamily: boolean;
  isNestedInFamily: boolean;
};

/** Visual family metadata keyed by item id (for flat drag layout). */
export function getFamilyChromeByItemId(
  flatItems: FlatListItem[],
): Map<string, ListItemFamilyChrome> {
  const chrome = new Map<string, ListItemFamilyChrome>();

  for (const family of groupFlatListItemsIntoFamilies(flatItems)) {
    const isSolo = family.items.length === 1;
    family.items.forEach((row, index) => {
      chrome.set(row.id, {
        familyRootId: family.rootId,
        isFamilyRoot: index === 0,
        isFamilyLast: index === family.items.length - 1,
        isSoloFamily: isSolo,
        isNestedInFamily: row.depth > 0,
      });
    });
  }

  return chrome;
}

type DragRect = { top: number; height: number };

/** True when the dragged row center is below the hovered row center. */
export function shouldInsertAfterOver(activeRect: DragRect, overRect: DragRect): boolean {
  const activeMidY = activeRect.top + activeRect.height / 2;
  const overMidY = overRect.top + overRect.height / 2;
  return activeMidY > overMidY;
}

type DragEventRects = {
  active: {
    rect: {
      current: {
        translated: DragRect | null;
        initial: DragRect | null;
      };
    };
  };
  over: { rect: DragRect } | null;
};

/** Pointer side of the hovered row — shared by preview and commit. */
export function getInsertAfterOverFromDragEvent(event: DragEventRects): boolean {
  const { active, over } = event;
  if (!over) return false;

  const overRect = over.rect;
  const activeRect = active.rect.current.translated ?? active.rect.current.initial;
  if (!overRect || !activeRect) return false;

  return shouldInsertAfterOver(activeRect, overRect);
}

/** Insert index in the lifted list (subtree rows excluded from the stack). */
export function computeFlatInsertIndex(
  itemIds: string[],
  activeId: string | null,
  overId: string | null,
  liftedIds?: ReadonlySet<string>,
  insertAfterOver = false,
): number | null {
  if (!activeId || !overId || activeId === overId) return null;

  const activeIdx = itemIds.indexOf(activeId);
  const overIdx = itemIds.indexOf(overId);
  if (activeIdx < 0 || overIdx < 0) return null;

  const exclude = liftedIds ?? new Set([activeId]);
  const stack = itemIds.filter((id) => !exclude.has(id));
  let insertIdx = stack.indexOf(overId);
  if (insertIdx < 0) return null;
  if (insertAfterOver) insertIdx += 1;
  return insertIdx;
}

/** Depth for the insertion line at a positional gap in the lifted list. */
export function computeInsertIndicatorDepth(
  reducedFlat: FlatListItem[],
  insertIdx: number,
  activeDepth: number,
): number {
  const rowBefore = insertIdx > 0 ? reducedFlat[insertIdx - 1] : null;
  const rowAfter = reducedFlat[insertIdx] ?? null;

  if (activeDepth > 0) return activeDepth;

  if (rowBefore && rowAfter && rowBefore.depth < rowAfter.depth) {
    return rowBefore.depth + 1;
  }

  return activeDepth;
}

/** Map insert index from the lifted list back onto the full rendered list. */
export function mapInsertIndexToRenderedList(
  itemIds: string[],
  liftedIds: ReadonlySet<string> | null,
  insertIndexInReduced: number | null,
): number | null {
  if (insertIndexInReduced === null) return null;

  const exclude = liftedIds ?? new Set<string>();
  let reducedIdx = 0;
  for (let i = 0; i < itemIds.length; i++) {
    if (exclude.has(itemIds[i])) continue;
    if (reducedIdx === insertIndexInReduced) return i;
    reducedIdx += 1;
  }

  return itemIds.length;
}