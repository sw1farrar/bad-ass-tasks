import { describe, expect, it } from "vitest";
import { mapNotebookTaskRow } from "@/lib/data/notebookSectionsStore";

describe("mapNotebookTaskRow", () => {
  it("maps show_on_workspace into showOnWorkspace", () => {
    const mapped = mapNotebookTaskRow({
      id: "t1",
      notebook_id: "n1",
      workspace_id: "w1",
      title: "Ship it",
      completed: false,
      sort_order: 1000,
      show_on_workspace: true,
      completed_at: null,
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    });

    expect(mapped.showOnWorkspace).toBe(true);
    expect(mapped.notebookId).toBe("n1");
  });

  it("defaults missing show_on_workspace to false", () => {
    const mapped = mapNotebookTaskRow({
      id: "t2",
      notebook_id: "n1",
      workspace_id: "w1",
      title: "Local only",
      completed: true,
      sort_order: 0,
      completed_at: "2026-07-13T01:00:00.000Z",
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T01:00:00.000Z",
    });

    expect(mapped.showOnWorkspace).toBe(false);
    expect(mapped.completed).toBe(true);
  });
});
