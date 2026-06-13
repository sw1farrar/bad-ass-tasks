import { describe, expect, it } from "vitest";
import { resolveListReorderAfterDrag } from "@/features/lists/lib/listDragReorder";
import type { WorkspaceList } from "@/types";

function makeList(id: string, sortOrder: number): WorkspaceList {
  return {
    id,
    workspaceId: "ws-1",
    title: id,
    color: "lavender",
    pinned: false,
    sortOrder,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("resolveListReorderAfterDrag", () => {
  const lists = [makeList("a", 0), makeList("b", 1), makeList("c", 2), makeList("d", 3)];

  it("returns no reorder when position is unchanged", () => {
    expect(
      resolveListReorderAfterDrag(lists, ["a", "b", "c", "d"], "b"),
    ).toEqual({ shouldReorder: false });
  });

  it("resolves moving an item down multiple slots", () => {
    expect(
      resolveListReorderAfterDrag(lists, ["b", "c", "d", "a"], "a"),
    ).toEqual({ shouldReorder: true, overId: "d" });
  });

  it("resolves moving an item up multiple slots", () => {
    expect(
      resolveListReorderAfterDrag(lists, ["d", "a", "b", "c"], "d"),
    ).toEqual({ shouldReorder: true, overId: "a" });
  });
});