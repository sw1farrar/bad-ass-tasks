import { describe, it, expect } from "vitest";
import {
  buildListHighlightsForWorkspace,
  computeWorkspaceListStats,
  mergeListItems,
  mergeWorkspaceLists,
  pickGlobalListHighlights,
} from "@/features/home/lib/buildListHighlights";
import type { ListItem, WorkspaceList } from "@/types";

const lists: WorkspaceList[] = [
  {
    id: "l1",
    workspaceId: "ws1",
    title: "Groceries",
    color: "green",
    sortOrder: 0,
    pinned: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "l2",
    workspaceId: "ws1",
    title: "Launch",
    color: "purple",
    sortOrder: 1000,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "l3",
    workspaceId: "ws2",
    title: "Ideas",
    color: "amber",
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
  },
];

const items: ListItem[] = [
  { id: "i1", listId: "l1", workspaceId: "ws1", text: "Milk", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
  { id: "i2", listId: "l1", workspaceId: "ws1", text: "Bread", completed: true, sortOrder: 1000, createdAt: "", updatedAt: "" },
  { id: "i3", listId: "l2", workspaceId: "ws1", text: "QA", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
  { id: "i4", listId: "l3", workspaceId: "ws2", text: "Widget", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
];

describe("buildListHighlightsForWorkspace", () => {
  it("returns per-list open counts and previews for one workspace", () => {
    const highlights = buildListHighlightsForWorkspace(lists, items, "ws1", "Acme");
    expect(highlights).toHaveLength(2);
    const groceries = highlights.find((h) => h.id === "l1");
    expect(groceries?.openCount).toBe(1);
    expect(groceries?.totalCount).toBe(2);
    expect(groceries?.preview).toEqual(["Milk"]);
    expect(groceries?.workspaceName).toBe("Acme");
  });

  it("counts items for live-linked shared lists using source workspace item rows", () => {
    const sharedList: WorkspaceList = {
      id: "l-shared",
      workspaceId: "ws2",
      title: "Shared groceries",
      color: "green",
      sortOrder: 0,
      isShared: true,
      sourceWorkspaceId: "ws1",
      createdAt: "",
      updatedAt: "",
    };
    const sharedItems: ListItem[] = [
      {
        id: "si1",
        listId: "l-shared",
        workspaceId: "ws1",
        text: "Eggs",
        completed: false,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const highlights = buildListHighlightsForWorkspace(
      [sharedList],
      sharedItems,
      "ws2",
      "Personal",
    );
    expect(highlights).toHaveLength(1);
    expect(highlights[0].openCount).toBe(1);
    expect(highlights[0].preview).toEqual(["Eggs"]);
  });
});

describe("computeWorkspaceListStats", () => {
  it("counts lists and open items in a workspace", () => {
    expect(computeWorkspaceListStats(lists, items, "ws1")).toEqual({
      listCount: 2,
      openListItemsCount: 2,
    });
  });
});

describe("mergeWorkspaceLists", () => {
  it("upserts by workspace and list id without dropping other workspaces", () => {
    const merged = mergeWorkspaceLists(lists, [
      { ...lists[0], title: "Updated groceries" },
      {
        id: "l9",
        workspaceId: "ws2",
        title: "New",
        color: "blue",
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(merged.find((l) => l.id === "l1")?.title).toBe("Updated groceries");
    expect(merged.filter((l) => l.workspaceId === "ws2")).toHaveLength(2);
  });
});

describe("mergeListItems", () => {
  it("upserts items by id", () => {
    const merged = mergeListItems(items, [
      { ...items[0], text: "Almond milk" },
      {
        id: "i9",
        listId: "l3",
        workspaceId: "ws2",
        text: "More",
        completed: false,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(merged.find((i) => i.id === "i1")?.text).toBe("Almond milk");
    expect(merged).toHaveLength(5);
  });
});

describe("pickGlobalListHighlights", () => {
  it("prioritizes pinned lists then open count and caps results", () => {
    const all = [
      ...buildListHighlightsForWorkspace(lists, items, "ws1", "Acme"),
      ...buildListHighlightsForWorkspace(lists, items, "ws2", "Personal"),
    ];
    const picked = pickGlobalListHighlights(all, 2);
    expect(picked).toHaveLength(2);
    expect(picked[0].id).toBe("l1");
    expect(picked.every((h) => h.openCount > 0 || h.pinned)).toBe(true);
  });
});