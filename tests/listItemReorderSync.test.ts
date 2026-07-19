import { describe, expect, it } from "vitest";
import type { ListItem } from "@/types";
import {
  beginListItemChecklistSync,
  endListItemChecklistSync,
  hasPendingListItemReorder,
  mergeRemoteListItemUpdate,
  notePersistedListItemPlacement,
} from "@/lib/lists/listItemReorderSync";

function item(overrides: Partial<ListItem> & Pick<ListItem, "id">): ListItem {
  return {
    listId: "list-1",
    workspaceId: "ws-1",
    text: "Item",
    completed: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mergeRemoteListItemUpdate", () => {
  it("keeps local placement while a list reorder is pending", async () => {
    const { enqueueListReorderPersist } = await import("@/lib/lists/listItemReorderSync");

    let resolvePersist!: () => void;
    const persistGate = new Promise<void>((resolve) => {
      resolvePersist = resolve;
    });

    enqueueListReorderPersist("list-1", async () => {
      await persistGate;
    });

    expect(hasPendingListItemReorder("list-1")).toBe(true);

    const local = item({ id: "a", sortOrder: 3000, updatedAt: "2026-01-02T00:00:00.000Z" });
    const remote = item({ id: "a", sortOrder: 1000, updatedAt: "2026-01-02T00:00:01.000Z" });

    const merged = mergeRemoteListItemUpdate(local, remote);
    expect(merged.sortOrder).toBe(3000);
    expect(merged.updatedAt).toBe(local.updatedAt);

    resolvePersist();
    await persistGate;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hasPendingListItemReorder("list-1")).toBe(false);
  });

  it("ignores stale remote placement after the latest write was persisted", () => {
    const local = item({ id: "a", sortOrder: 3000, updatedAt: "2026-01-02T00:00:00.000Z" });
    notePersistedListItemPlacement("a", { sortOrder: 3000, parentItemId: null });

    const staleRemote = item({
      id: "a",
      sortOrder: 1000,
      updatedAt: "2026-01-02T00:00:05.000Z",
    });

    const merged = mergeRemoteListItemUpdate(local, staleRemote);
    expect(merged.sortOrder).toBe(3000);
    expect(merged.text).toBe(staleRemote.text);
  });

  it("accepts remote placement that matches the last persisted write", () => {
    const local = item({ id: "a", sortOrder: 2000 });
    notePersistedListItemPlacement("a", { sortOrder: 2000, parentItemId: null });

    const remote = item({ id: "a", sortOrder: 2000, text: "Updated remotely" });
    const merged = mergeRemoteListItemUpdate(local, remote);

    expect(merged.sortOrder).toBe(2000);
    expect(merged.text).toBe("Updated remotely");
  });

  it("keeps local checklist state while a completion sync is in flight", () => {
    beginListItemChecklistSync("a");
    try {
      const local = item({
        id: "a",
        completed: true,
        completedAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      });
      const remote = item({
        id: "a",
        completed: false,
        text: "Milk",
        updatedAt: "2026-01-02T00:00:05.000Z",
      });

      const merged = mergeRemoteListItemUpdate(local, remote);
      expect(merged.completed).toBe(true);
      expect(merged.completedAt).toBe("2026-01-02T00:00:00.000Z");
      expect(merged.text).toBe("Milk");
    } finally {
      endListItemChecklistSync("a");
    }
  });

  it("keeps newer local checklist state over a stale remote hydrate", () => {
    const local = item({
      id: "a",
      completed: true,
      completedAt: "2026-01-02T00:00:10.000Z",
      updatedAt: "2026-01-02T00:00:10.000Z",
    });
    const remote = item({
      id: "a",
      completed: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const merged = mergeRemoteListItemUpdate(local, remote);
    expect(merged.completed).toBe(true);
    expect(merged.completedAt).toBe("2026-01-02T00:00:10.000Z");
  });

  it("accepts a newer remote checklist change", () => {
    const local = item({
      id: "a",
      completed: true,
      completedAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    const remote = item({
      id: "a",
      completed: false,
      completedAt: undefined,
      updatedAt: "2026-01-02T00:00:30.000Z",
    });

    const merged = mergeRemoteListItemUpdate(local, remote);
    expect(merged.completed).toBe(false);
    expect(merged.completedAt).toBeUndefined();
  });
});