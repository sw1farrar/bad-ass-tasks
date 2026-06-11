import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import {
  canIndentListItem,
  canOutdentListItem,
  computeOutdentUpdate,
  flattenListItems,
  getIndentParentId,
  getOutdentParentId,
  sortOrderForInsertAfter,
} from "@/lib/lists/listItemTree";

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

describe("flattenListItems", () => {
  it("orders parents before children", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000),
    ];
    const flat = flattenListItems(items);
    expect(flat.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(flat.find((i) => i.id === "b")?.depth).toBe(1);
  });
});

describe("sortOrderForInsertAfter", () => {
  it("places a new item between siblings", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];
    const placement = sortOrderForInsertAfter(items, "a");
    expect(placement).toEqual({ parentItemId: null, sortOrder: 500 });
  });

  it("appends after the last sibling", () => {
    const items = [item("a", 0), item("b", 1000)];
    const placement = sortOrderForInsertAfter(items, "b");
    expect(placement).toEqual({ parentItemId: null, sortOrder: 2000 });
  });
});

describe("indent/outdent", () => {
  const items = [item("a", 0), item("b", 1000), item("c", 2000)];

  it("indents under previous sibling", () => {
    expect(canIndentListItem("b", items)).toBe(true);
    expect(getIndentParentId("b", items)).toBe("a");
  });

  it("cannot indent first item", () => {
    expect(canIndentListItem("a", items)).toBe(false);
  });

  it("indents siblings under the item above them", () => {
    const nested = [item("a", 0), item("b", 0, "a"), item("c", 1000, "a")];
    expect(getIndentParentId("c", nested)).toBe("b");
  });

  it("supports nesting deeper than three levels", () => {
    const deep = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 0, "c"),
      item("e", 0, "d"),
      item("f", 1000, "d"),
    ];
    const flat = flattenListItems(deep);
    expect(flat.map((row) => row.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(flat.map((row) => row.depth)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(canIndentListItem("f", deep)).toBe(true);
    expect(getIndentParentId("f", deep)).toBe("e");
  });

  it("outdents to grandparent", () => {
    const nested = [item("a", 0), item("b", 0, "a")];
    expect(canOutdentListItem("b", nested)).toBe(true);
    expect(getOutdentParentId("b", nested)).toBe(null);
  });
});

describe("computeOutdentUpdate", () => {
  it("places the outdented item after its parent, not at the list tail", () => {
    const items = [
      item("a", 0),
      item("b", 1000),
      item("c", 0, "b"),
      item("d", 2000),
      item("e", 3000),
    ];

    const update = computeOutdentUpdate(items, "c");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe(null);
    expect(update!.sortOrder).toBe(2000);

    const nextItems = items.map((row) => {
      const sortOrder = update!.siblingSortOrders.get(row.id);
      if (sortOrder === undefined) return row;
      return {
        ...row,
        parentItemId: row.id === "c" ? update!.parentItemId ?? undefined : row.parentItemId,
        sortOrder,
      };
    });

    expect(flattenListItems(nextItems).map((row) => row.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps nested outdents after the parent among cousins", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 1000, "a"),
    ];

    const update = computeOutdentUpdate(items, "c");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe("a");

    const nextItems = items.map((row) => {
      const sortOrder = update!.siblingSortOrders.get(row.id);
      if (sortOrder === undefined) return row;
      return {
        ...row,
        parentItemId: row.id === "c" ? update!.parentItemId ?? undefined : row.parentItemId,
        sortOrder,
      };
    });

    expect(flattenListItems(nextItems).map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });
});