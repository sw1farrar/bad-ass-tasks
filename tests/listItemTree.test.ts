import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import {
  canIndentListItem,
  canOutdentListItem,
  computeFlatListReorder,
  computeIndentUpdate,
  computeOutdentUpdate,
  flattenListItems,
  getIndentParentId,
  getOutdentParentId,
  firstSortOrderAmongSiblings,
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

describe("firstSortOrderAmongSiblings", () => {
  it("returns 0 for the first item in a group", () => {
    expect(firstSortOrderAmongSiblings([], "list-1", null)).toBe(0);
  });

  it("places a new item before existing siblings", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];
    expect(firstSortOrderAmongSiblings(items, "list-1", null)).toBe(-1000);
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

  it("allows a second indent level but blocks a third", () => {
    const nested = [item("a", 0), item("b", 0, "a"), item("c", 1000, "a")];
    expect(canIndentListItem("b", nested)).toBe(false);
    expect(canIndentListItem("c", nested)).toBe(true);
    expect(getIndentParentId("c", nested)).toBe("b");

    const twoDeep = [item("a", 0), item("b", 0, "a"), item("c", 0, "b")];
    expect(canIndentListItem("c", twoDeep)).toBe(false);
    expect(computeIndentUpdate(twoDeep, "c")).toBeNull();
  });

  it("still renders legacy deeper trees but blocks further indents", () => {
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
    expect(canIndentListItem("f", deep)).toBe(false);
    expect(computeIndentUpdate(deep, "f")).toBeNull();
  });

  it("outdents to grandparent", () => {
    const nested = [item("a", 0), item("b", 0, "a")];
    expect(canOutdentListItem("b", nested)).toBe(true);
    expect(getOutdentParentId("b", nested)).toBe(null);
  });
});

describe("cross-list isolation", () => {
  function crossListItem(
    id: string,
    listId: string,
    sortOrder: number,
    parentItemId?: string | null,
  ): ListItem {
    return {
      id,
      listId,
      workspaceId: "ws-1",
      text: id,
      completed: false,
      sortOrder,
      parentItemId,
      createdAt: "",
      updatedAt: "",
    };
  }

  it("does not parent across lists when workspace items are interleaved", () => {
    const all = [
      crossListItem("a", "list-1", 0),
      crossListItem("b", "list-2", 1000),
      crossListItem("c", "list-1", 2000),
    ];
    const list1Only = all.filter((row) => row.listId === "list-1");
    const update = computeIndentUpdate(list1Only, "c");
    expect(update?.parentItemId).toBe("a");
    expect(update?.parentItemId).not.toBe("b");
  });

  it("keeps orphaned items visible in flatten", () => {
    const items = [item("a", 0), item("b", 0, "ghost")];
    expect(flattenListItems(items).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

function applyUpdates(
  items: ListItem[],
  updates: Map<string, { parentItemId?: string | null; sortOrder: number }>,
): ListItem[] {
  return items.map((row) => {
    const update = updates.get(row.id);
    if (!update) return row;
    return {
      ...row,
      parentItemId:
        update.parentItemId === null
          ? undefined
          : update.parentItemId === undefined
            ? row.parentItemId
            : update.parentItemId,
      sortOrder: update.sortOrder,
    };
  });
}

describe("computeFlatListReorder", () => {
  it("moves a nested item between top-level rows and keeps its indent", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000),
      item("d", 2000),
    ];

    const result = computeFlatListReorder(items, "b", "d");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["a", "c", "d", "b"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("d");
    expect(flat.find((row) => row.id === "b")?.depth).toBe(1);
  });

  it("keeps nested indent when reordered among siblings", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000, "a"),
      item("d", 2000),
    ];

    const result = computeFlatListReorder(items, "b", "c");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["a", "c", "b", "d"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
    expect(flat.find((row) => row.id === "b")?.depth).toBe(1);
  });

  it("moves a top-level item to become a child when dropped on a nested row", () => {
    const items = [item("a", 0), item("c", 0, "a"), item("b", 1000)];

    const result = computeFlatListReorder(items, "b", "c");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
  });

  it("reorders siblings at the same level", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];

    const result = computeFlatListReorder(items, "a", "c");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a parent and its nested descendants together", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 1000),
      item("e", 2000),
    ];

    const result = computeFlatListReorder(items, "a", "e");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["d", "e", "a", "b", "c"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
    expect(next.find((row) => row.id === "c")?.parentItemId).toBe("b");
    expect(flat.find((row) => row.id === "b")?.depth).toBe(1);
    expect(flat.find((row) => row.id === "c")?.depth).toBe(2);
  });

  it("refuses dropping a parent onto its own descendant", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
    ];
    expect(computeFlatListReorder(items, "a", "c")).toBeNull();
    expect(computeFlatListReorder(items, "a", "b")).toBeNull();
  });
});

describe("computeIndentUpdate", () => {
  it("inserts the item as the first child under the row above", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];

    const update = computeIndentUpdate(items, "b");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe("a");

    const next = items.map((row) => {
      const sortOrder = update!.siblingSortOrders.get(row.id);
      if (sortOrder === undefined) return row;
      return {
        ...row,
        parentItemId: row.id === "b" ? update!.parentItemId : row.parentItemId,
        sortOrder,
      };
    });

    expect(flattenListItems(next).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("indents to the second level under the row above", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 1000)];
    const update = computeIndentUpdate(items, "c");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe("b");
  });

  it("refuses a third indent that would exceed max depth", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 0, "b")];
    expect(computeIndentUpdate(items, "c")).toBeNull();
  });

  it("allows a second indent by promoting the parent row above", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 0, "b")];

    expect(canIndentListItem("c", items)).toBe(true);

    const update = computeIndentUpdate(items, "c");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe("b");
    expect(update!.parentPromotion).toEqual({ itemId: "b", parentItemId: "a" });

    const next = items.map((row) => {
      const sortOrder = update!.siblingSortOrders.get(row.id);
      const parentItemId =
        row.id === "c"
          ? update!.parentItemId
          : update!.parentPromotion?.itemId === row.id
            ? update!.parentPromotion.parentItemId
            : row.parentItemId;
      if (sortOrder === undefined && parentItemId === row.parentItemId) return row;
      return {
        ...row,
        parentItemId,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      };
    });

    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(flat.map((row) => row.depth)).toEqual([0, 1, 2]);
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