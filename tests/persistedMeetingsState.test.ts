import { describe, expect, it } from "vitest";
import {
  TASK_STORE_PERSIST_VERSION,
  migratePersistedTaskState,
} from "@/store/useTaskStore";

describe("migratePersistedTaskState", () => {
  it("drops stored meetings and sends the removed view home", () => {
    const migrated = migratePersistedTaskState(
      {
        tasks: [{ id: "t1" }],
        notes: [{ id: "n1" }],
        meetings: [{ id: "m1", title: "Weekly sync" }],
        meetingAgendaItems: [{ id: "a1" }],
        meetingAgendaEntries: [{ id: "e1" }],
        selectedMeetingId: "m1",
        selectedAgendaItemId: "a1",
        currentView: "meetings",
      },
      0,
    ) as Record<string, unknown>;

    expect(migrated.tasks).toEqual([{ id: "t1" }]);
    expect(migrated.notes).toEqual([{ id: "n1" }]);
    expect(migrated.currentView).toBe("home");
    expect(migrated).not.toHaveProperty("meetings");
    expect(migrated).not.toHaveProperty("meetingAgendaItems");
    expect(migrated).not.toHaveProperty("meetingAgendaEntries");
    expect(migrated).not.toHaveProperty("selectedMeetingId");
    expect(migrated).not.toHaveProperty("selectedAgendaItemId");
  });

  it("leaves current storage alone once it is already on this version", () => {
    const current = { tasks: [], currentView: "tasks", meetings: [{ id: "stale" }] };
    expect(migratePersistedTaskState(current, TASK_STORE_PERSIST_VERSION)).toEqual(current);
    expect(TASK_STORE_PERSIST_VERSION).toBeGreaterThan(0);
  });
});
