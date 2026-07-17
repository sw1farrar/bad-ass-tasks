import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import {
  canIndentListItem,
  canOutdentListItem,
  computeFlatListNudge,
  computeFlatListReorder,
  computeMoveListSubtreeToList,
  computeIndentUpdate,
  getFlatListNudgeTargets,
  computeOutdentUpdate,
  flattenListItems,
  getFamilyRootIdForFlatItem,
  getIncompleteSubtreeItems,
  getSubtreeMaxRelativeDepth,
  groupFlatListItemsIntoFamilies,
  hasIncompleteDescendants,
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

describe("family completion helpers", () => {
  it("detects open descendants and lists incomplete subtree items in order", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000, "a"),
      item("d", 2000),
    ];
    const flat = flattenListItems(items);

    expect(hasIncompleteDescendants("a", items)).toBe(true);
    expect(hasIncompleteDescendants("b", items)).toBe(false);
    expect(hasIncompleteDescendants("d", items)).toBe(false);
    expect(getIncompleteSubtreeItems("a", items).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(getIncompleteSubtreeItems("b", items).map((row) => row.id)).toEqual(["b"]);
    expect(flat.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("getFamilyRootIdForFlatItem", () => {
  it("returns the root id for nested items", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 1000), item("d", 0, "c")];
    const flat = flattenListItems(items);
    expect(getFamilyRootIdForFlatItem(flat, "b")).toBe("a");
    expect(getFamilyRootIdForFlatItem(flat, "d")).toBe("c");
    expect(getFamilyRootIdForFlatItem(flat, "a")).toBe("a");
  });
});

describe("groupFlatListItemsIntoFamilies", () => {
  it("groups a root item with its nested descendants", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 1000), item("d", 0, "c")];
    const families = groupFlatListItemsIntoFamilies(flattenListItems(items));
    expect(families).toHaveLength(2);
    expect(families[0].items.map((row) => row.id)).toEqual(["a", "b"]);
    expect(families[1].items.map((row) => row.id)).toEqual(["c", "d"]);
  });

  it("keeps standalone roots as single-item families", () => {
    const items = [item("a", 0), item("b", 1000)];
    const families = groupFlatListItemsIntoFamilies(flattenListItems(items));
    expect(families).toHaveLength(2);
    expect(families[0].items).toHaveLength(1);
    expect(families[1].items).toHaveLength(1);
  });
});

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

  it("indents below a parent instead of under its child when a top-level row follows a family", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 1000)];
    expect(getIndentParentId("c", items)).toBe("a");
    expect(computeIndentUpdate(items, "c")?.parentItemId).toBe("a");
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

    const result = computeFlatListReorder(items, "b", "d", true);
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

    const result = computeFlatListReorder(items, "b", "c", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["a", "c", "b", "d"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
    expect(flat.find((row) => row.id === "b")?.depth).toBe(1);
  });

  it("places a top-level item in the gap before a nested row", () => {
    const items = [item("a", 0), item("c", 0, "a"), item("b", 1000)];

    const result = computeFlatListReorder(items, "b", "c");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
  });

  it("reorders top-level siblings without nesting onto a leaf row", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];

    const result = computeFlatListReorder(items, "a", "c", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(next.find((row) => row.id === "a")?.parentItemId).toBeUndefined();
    expect(flattenListItems(next).find((row) => row.id === "a")?.depth).toBe(0);
  });

  it("inserts a top-level item at the positional gap before a parent with children", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000), item("c1", 0, "c")];

    const result = computeFlatListReorder(items, "a", "c", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["b", "c", "a", "c1"]);
    expect(next.find((row) => row.id === "a")?.parentItemId).toBe("c");
  });

  it("places a top-level item in the gap before a child row", () => {
    const items = [item("a", 0), item("a1", 0, "a"), item("b", 1000)];

    const result = computeFlatListReorder(items, "b", "a1");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["a", "b", "a1"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
  });

  it("keeps a top-level item top-level when dropped after a parent row", () => {
    const items = [item("a", 0), item("a1", 0, "a"), item("b", 1000)];

    const result = computeFlatListReorder(items, "b", "a", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["a", "b", "a1"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
  });

  it("moves a parent and its nested descendants together", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 1000),
      item("e", 2000),
    ];

    const result = computeFlatListReorder(items, "a", "e", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    const flat = flattenListItems(next);
    expect(flat.map((row) => row.id)).toEqual(["d", "e", "a", "b", "c"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
    expect(next.find((row) => row.id === "c")?.parentItemId).toBe("b");
    expect(flat.find((row) => row.id === "b")?.depth).toBe(1);
    expect(flat.find((row) => row.id === "c")?.depth).toBe(2);
  });

  it("moves a deep subtree while keeping the root top-level", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 1000),
    ];
    expect(getSubtreeMaxRelativeDepth("a", items)).toBe(2);

    const result = computeFlatListReorder(items, "a", "d", true);
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(next.find((row) => row.id === "a")?.parentItemId).toBeUndefined();
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["d", "a", "b", "c"]);
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

describe("computeFlatListNudge", () => {
  it("moves a top-level item down one row", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 2000)];

    const result = computeFlatListNudge(items, "a", "down");
    expect(result).not.toBeNull();

    const next = items.map((row) => {
      const update = result!.updates.get(row.id);
      if (!update) return row;
      return {
        ...row,
        parentItemId: update.parentItemId === null ? undefined : update.parentItemId,
        sortOrder: update.sortOrder,
      };
    });

    expect(flattenListItems(next).map((row) => row.id)).toEqual(["b", "a", "c"]);
  });

  it("moves a top-level parent and its children above the previous family", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 0, "b"),
      item("d", 1000),
      item("e", 0, "d"),
    ];

    const targets = getFlatListNudgeTargets(items, "a");
    expect(targets.canMoveUp).toBe(false);
    expect(targets.canMoveDown).toBe(true);

    const result = computeFlatListNudge(items, "d", "up");
    expect(result).not.toBeNull();

    const next = items.map((row) => {
      const update = result!.updates.get(row.id);
      if (!update) return row;
      return {
        ...row,
        parentItemId: update.parentItemId === null ? undefined : update.parentItemId,
        sortOrder: update.sortOrder,
      };
    });

    expect(flattenListItems(next).map((row) => row.id)).toEqual(["d", "e", "a", "b", "c"]);
    expect(next.find((row) => row.id === "e")?.parentItemId).toBe("d");
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
  });

  it("moves a top-level parent and its children below the next family", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000),
      item("d", 0, "c"),
      item("e", 2000),
    ];

    const result = computeFlatListNudge(items, "a", "down");
    expect(result).not.toBeNull();

    const next = applyUpdates(items, result!.updates);
    expect(flattenListItems(next).map((row) => row.id)).toEqual(["c", "d", "a", "b", "e"]);
    expect(next.find((row) => row.id === "b")?.parentItemId).toBe("a");
    expect(next.find((row) => row.id === "d")?.parentItemId).toBe("c");
  });

  it("respects a visible-item subset when nudging", () => {
    const withCompleted: ListItem[] = [
      { ...item("a", 0), completed: false },
      {
        ...item("b", 1000),
        completed: true,
        completedAt: new Date().toISOString(),
      },
      { ...item("c", 2000), completed: false },
    ];
    const visible = new Set(["a", "c"]);

    expect(getFlatListNudgeTargets(withCompleted, "c", visible).upOverId).toBe("a");
    expect(getFlatListNudgeTargets(withCompleted, "a", visible).downOverId).toBe("c");

    const result = computeFlatListNudge(withCompleted, "c", "up", visible);
    expect(result).not.toBeNull();

    const next = withCompleted.map((row) => {
      const update = result!.updates.get(row.id);
      if (!update) return row;
      return {
        ...row,
        parentItemId: update.parentItemId === null ? undefined : update.parentItemId,
        sortOrder: update.sortOrder,
      };
    });

    expect(flattenListItems(next).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });
});

describe("computeMoveListSubtreeToList", () => {
  it("moves a subtree to another list with the root appended at top level", () => {
    const items = [
      item("a", 0),
      item("b", 0, "a"),
      item("c", 1000),
      { ...item("d", 0), listId: "list-2" },
      { ...item("e", 1000), listId: "list-2" },
    ];

    const updates = computeMoveListSubtreeToList(items, "a", "list-2");
    expect(updates).not.toBeNull();
    expect(updates!.get("a")).toMatchObject({
      listId: "list-2",
      parentItemId: undefined,
      sortOrder: 2000,
    });
    expect(updates!.get("b")).toMatchObject({
      listId: "list-2",
      parentItemId: "a",
      sortOrder: 0,
    });
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

  it("indents one level under the nearest row at the same depth, not a nested row above", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 1000)];
    expect(getIndentParentId("c", items)).toBe("a");
    const update = computeIndentUpdate(items, "c");
    expect(update).not.toBeNull();
    expect(update!.parentItemId).toBe("a");

    const next = items.map((row) =>
      row.id === "c"
        ? { ...row, parentItemId: update!.parentItemId, sortOrder: update!.sortOrder }
        : row,
    );
    expect(flattenListItems(next).find((row) => row.id === "c")?.depth).toBe(1);
  });

  it("refuses a third indent that would exceed max depth", () => {
    const items = [item("a", 0), item("b", 0, "a"), item("c", 0, "b")];
    expect(computeIndentUpdate(items, "c")).toBeNull();
  });

  it("does not double-indent when the row above is already the parent", () => {
    const items = [item("a", 0), item("b", 1000), item("c", 0, "b")];

    expect(canIndentListItem("c", items)).toBe(false);
    expect(computeIndentUpdate(items, "c")).toBeNull();
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