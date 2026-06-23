import { describe, expect, it } from "vitest";
import type { Note, Task } from "@/types";
import {
  getTaskLinkedFileNotes,
  taskHasLinkedFiles,
} from "@/features/tasks/lib/taskLinkedFiles";

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  description: "",
  status: "todo",
  priority: "P2",
  tags: [],
  createdAt: "",
  linkedNoteIds: [],
  workspaceId: "w1",
  ...overrides,
});

const baseNote = (overrides: Partial<Note> = {}): Note => ({
  id: "n1",
  title: "File",
  content: "",
  createdAt: "",
  updatedAt: "",
  tags: [],
  linkedTaskIds: [],
  workspaceId: "w1",
  ...overrides,
});

describe("taskLinkedFiles", () => {
  it("taskHasLinkedFiles is true when linkedNoteIds has entries", () => {
    expect(taskHasLinkedFiles(baseTask())).toBe(false);
    expect(taskHasLinkedFiles(baseTask({ linkedNoteIds: ["n1"] }))).toBe(true);
  });

  it("getTaskLinkedFileNotes resolves notes in link order", () => {
    const notes = [
      baseNote({ id: "n1", title: "First" }),
      baseNote({ id: "n2", title: "Second" }),
    ];
    const task = baseTask({ linkedNoteIds: ["n2", "missing", "n1"] });
    expect(getTaskLinkedFileNotes(task, notes).map((n) => n.id)).toEqual(["n2", "n1"]);
  });
});