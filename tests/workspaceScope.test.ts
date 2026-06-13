import { describe, expect, it } from "vitest";
import { commentBelongsToWorkspace } from "@/lib/realtime/workspaceScope";

describe("commentBelongsToWorkspace", () => {
  const state = {
    currentWorkspace: { id: "ws-1" },
    tasks: [{ id: "t1", workspaceId: "ws-1" } as any],
    notes: [{ id: "n1", workspaceId: "ws-1" } as any],
  };

  it("accepts comments on tasks in the workspace", () => {
    expect(commentBelongsToWorkspace(state, { task_id: "t1" })).toBe(true);
  });

  it("accepts comments on notes in the workspace", () => {
    expect(commentBelongsToWorkspace(state, { note_id: "n1" })).toBe(true);
  });

  it("rejects comments linked to entities outside the workspace", () => {
    expect(commentBelongsToWorkspace(state, { task_id: "other-task" })).toBe(false);
    expect(commentBelongsToWorkspace(state, { note_id: "other-note" })).toBe(false);
  });
});