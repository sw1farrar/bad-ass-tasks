import { describe, expect, it, beforeEach } from "vitest";
import { useTaskStore } from "@/store/useTaskStore";
import type { ListItem, WorkspaceList } from "@/types";

function baseList(overrides: Partial<WorkspaceList>): WorkspaceList {
  return {
    id: "list-1",
    workspaceId: "ws-target",
    title: "Shared groceries",
    color: "green",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseItem(overrides: Partial<ListItem>): ListItem {
  return {
    id: "item-1",
    listId: "list-1",
    workspaceId: "ws-source",
    text: "Milk",
    completed: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getListItemsForList", () => {
  beforeEach(() => {
    useTaskStore.setState({
      currentWorkspace: {
        id: "ws-target",
        name: "Target",
        createdAt: "2026-01-01T00:00:00.000Z",
      } as never,
      workspaceLists: [],
      listItems: [],
    });
  });

  it("returns shared-list items even when they keep the source workspaceId", () => {
    useTaskStore.setState({
      workspaceLists: [
        baseList({
          isShared: true,
          sourceWorkspaceId: "ws-source",
          workspaceId: "ws-target",
        }),
      ],
      listItems: [baseItem({ workspaceId: "ws-source" })],
    });

    const items = useTaskStore.getState().getListItemsForList("list-1", "ws-target");
    expect(items.map((i) => i.id)).toEqual(["item-1"]);
  });

  it("prefers the shared projection when an owned copy of the same id also exists", () => {
    useTaskStore.setState({
      workspaceLists: [
        baseList({
          id: "list-1",
          workspaceId: "ws-source",
          isShared: false,
        }),
        baseList({
          id: "list-1",
          workspaceId: "ws-target",
          isShared: true,
          sourceWorkspaceId: "ws-source",
        }),
      ],
      listItems: [baseItem({ workspaceId: "ws-source" })],
    });

    const items = useTaskStore.getState().getListItemsForList("list-1", "ws-target");
    expect(items.map((i) => i.id)).toEqual(["item-1"]);
  });

  it("scopes owned-list items to the list workspace, not only the current workspace", () => {
    useTaskStore.setState({
      currentWorkspace: {
        id: "ws-other",
        name: "Other",
        createdAt: "2026-01-01T00:00:00.000Z",
      } as never,
      workspaceLists: [
        baseList({
          workspaceId: "ws-owned",
          isShared: false,
        }),
      ],
      listItems: [baseItem({ workspaceId: "ws-owned" })],
    });

    const items = useTaskStore.getState().getListItemsForList("list-1", "ws-owned");
    expect(items.map((i) => i.id)).toEqual(["item-1"]);
  });
});
