import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import { flattenListItems } from "@/lib/lists/listItemTree";
import {
  computeFlatInsertIndex,
  getFamilyChromeByItemId,
  mapInsertIndexToRenderedList,
} from "@/lib/lists/listDragPreview";

function item(
  id: string,
  sortOrder: number,
  parentItemId?: string | null,
): ListItem {
  return {
    id,
    listId: "list-1",
    workspaceId: "ws-1",
    text: id,
    completed: false,
    sortOrder,
    parentItemId,
    createdAt: "",
    updatedAt: "",
  };
}

describe("listDragPreview", () => {
  it("maps family chrome for grouped rows", () => {
    const flat = flattenListItems([
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000),
    ]);
    const chrome = getFamilyChromeByItemId(flat);

    expect(chrome.get("a")).toMatchObject({
      familyRootId: "a",
      isFamilyRoot: true,
      isFamilyLast: false,
      isSoloFamily: false,
    });
    expect(chrome.get("b")).toMatchObject({
      familyRootId: "a",
      isNestedInFamily: true,
      isFamilyLast: true,
    });
    expect(chrome.get("c")).toMatchObject({
      isSoloFamily: true,
      isFamilyRoot: true,
      isFamilyLast: true,
    });
  });

  it("computes insert index for lifted active items", () => {
    const ids = ["a", "b", "c"];
    expect(computeFlatInsertIndex(ids, "a", "c", undefined, true)).toBe(2);
    expect(mapInsertIndexToRenderedList(ids, new Set(["a"]), 2)).toBe(3);
    expect(computeFlatInsertIndex(ids, "c", "a", undefined, false)).toBe(0);
    expect(mapInsertIndexToRenderedList(ids, new Set(["c"]), 0)).toBe(0);
  });

  it("lifts an entire subtree when mapping insert index", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const lifted = new Set(["a", "b", "c"]);
    expect(computeFlatInsertIndex(ids, "a", "e", lifted, true)).toBe(2);
    expect(mapInsertIndexToRenderedList(ids, lifted, 2)).toBe(5);
  });

  it("uses positional insert only when dropping onto a parent with children", () => {
    const items = [
      item("a", 0),
      item("b", 1000),
      item("c", 2000),
      item("c1", 0, "c"),
    ];

    const ids = flattenListItems(items).map((row) => row.id);
    const lifted = new Set(["a"]);
    const insertIndex = computeFlatInsertIndex(ids, "a", "c", lifted, true);
    expect(insertIndex).toBe(2);
    expect(mapInsertIndexToRenderedList(ids, lifted, insertIndex)).toBe(3);
  });
});