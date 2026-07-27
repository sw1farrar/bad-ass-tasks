import { describe, expect, it } from "vitest";
import {
  agendaEntryBelongsToWorkspace,
  agendaItemBelongsToWorkspace,
  commentBelongsToWorkspace,
} from "@/lib/realtime/workspaceScope";

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

describe("meeting agenda realtime scope", () => {
  const state = {
    currentWorkspace: { id: "ws-1" },
    meetings: [
      { id: "m1", workspaceId: "ws-1" } as any,
      { id: "m2", workspaceId: "ws-2" } as any,
    ],
    meetingAgendaItems: [
      { id: "a1", meetingId: "m1" } as any,
      { id: "a2", meetingId: "m2" } as any,
    ],
  };

  it("accepts agenda items for meetings in the workspace", () => {
    expect(agendaItemBelongsToWorkspace(state, { meeting_id: "m1" })).toBe(true);
  });

  it("rejects agenda items for meetings outside the workspace", () => {
    expect(agendaItemBelongsToWorkspace(state, { meeting_id: "m2" })).toBe(false);
  });

  it("accepts entries under in-workspace agenda items", () => {
    expect(agendaEntryBelongsToWorkspace(state, { agenda_item_id: "a1" })).toBe(true);
  });

  it("rejects entries under out-of-workspace agenda items", () => {
    expect(agendaEntryBelongsToWorkspace(state, { agenda_item_id: "a2" })).toBe(false);
  });
});