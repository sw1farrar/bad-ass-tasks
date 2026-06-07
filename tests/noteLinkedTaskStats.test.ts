import { describe, it, expect } from "vitest";
import {
  getNoteLinkedTaskStats,
  sortNotesByOpenTaskUrgency,
} from "@/features/notes/lib/noteLinkedTaskStats";
import type { Note, Task } from "@/types";

const baseNote = (overrides: Partial<Note> = {}): Note => ({
  id: "n1",
  title: "Note",
  content: "",
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-05T12:00:00.000Z",
  tags: [],
  linkedTaskIds: [],
  workspaceId: "w1",
  ...overrides,
});

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  description: "",
  status: "todo",
  priority: "P2",
  tags: [],
  createdAt: "2026-06-01T12:00:00.000Z",
  linkedNoteIds: [],
  workspaceId: "w1",
  ...overrides,
});

describe("getNoteLinkedTaskStats", () => {
  it("returns empty stats when no linked tasks", () => {
    expect(getNoteLinkedTaskStats(baseNote(), [])).toEqual({
      total: 0,
      open: 0,
      overdue: 0,
      hasOpen: false,
      hasOverdue: false,
    });
  });

  it("counts open and overdue linked tasks", () => {
    const note = baseNote({ linkedTaskIds: ["t1", "t2", "t3"] });
    const tasks = [
      baseTask({ id: "t1", status: "done" }),
      baseTask({ id: "t2", status: "todo", dueDate: "2026-01-01" }),
      baseTask({ id: "t3", status: "doing" }),
    ];

    expect(getNoteLinkedTaskStats(note, tasks)).toEqual({
      total: 3,
      open: 2,
      overdue: 1,
      hasOpen: true,
      hasOverdue: true,
    });
  });
});

describe("sortNotesByOpenTaskUrgency", () => {
  it("puts overdue notes first", () => {
    const overdueNote = baseNote({
      id: "n-overdue",
      linkedTaskIds: ["t-overdue"],
      updatedAt: "2026-06-01T12:00:00.000Z",
    });
    const openNote = baseNote({
      id: "n-open",
      linkedTaskIds: ["t-open"],
      updatedAt: "2026-06-06T12:00:00.000Z",
    });
    const tasks = [
      baseTask({ id: "t-overdue", dueDate: "2026-01-01" }),
      baseTask({ id: "t-open", dueDate: "2026-12-01" }),
    ];

    const sorted = sortNotesByOpenTaskUrgency([openNote, overdueNote], tasks);
    expect(sorted.map((n) => n.id)).toEqual(["n-overdue", "n-open"]);
  });
});