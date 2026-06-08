import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import {
  canIndentListItem,
  canOutdentListItem,
  flattenListItems,
  getIndentParentId,
  getOutdentParentId,
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

describe("indent/outdent", () => {
  const items = [item("a", 0), item("b", 1000), item("c", 2000)];

  it("indents under previous sibling", () => {
    expect(canIndentListItem("b", items)).toBe(true);
    expect(getIndentParentId("b", items)).toBe("a");
  });

  it("cannot indent first item", () => {
    expect(canIndentListItem("a", items)).toBe(false);
  });

  it("outdents to grandparent", () => {
    const nested = [item("a", 0), item("b", 0, "a")];
    expect(canOutdentListItem("b", nested)).toBe(true);
    expect(getOutdentParentId("b", nested)).toBe(null);
  });
});