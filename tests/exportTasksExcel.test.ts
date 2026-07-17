import { describe, expect, it } from "vitest";
import {
  buildTasksExportRows,
  createDefaultTasksExportFilters,
  filterTasksForExport,
} from "@/features/tasks/lib/exportTasksExcel";
import type { Task, TaskFolder } from "@/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Sample",
    description: "",
    status: "todo",
    priority: "P2",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    linkedNoteIds: [],
    workspaceId: "w1",
    ...overrides,
  };
}

describe("filterTasksForExport", () => {
  const tasks = [
    makeTask({ id: "a", title: "Open work", status: "todo", starred: true }),
    makeTask({
      id: "b",
      title: "Done chore",
      status: "done",
      completedAt: "2026-02-01T00:00:00.000Z",
    }),
    makeTask({
      id: "c",
      title: "Weekly standup",
      status: "todo",
      recurringRule: "FREQ=WEEKLY",
      folderId: "f1",
    }),
  ];

  it("filters incomplete by default-compatible status", () => {
    const result = filterTasksForExport(
      tasks,
      createDefaultTasksExportFilters({ statusMode: "incomplete" }),
    );
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("filters completed only", () => {
    const result = filterTasksForExport(
      tasks,
      createDefaultTasksExportFilters({ statusMode: "completed" }),
    );
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });

  it("filters important and folders", () => {
    const result = filterTasksForExport(
      tasks,
      createDefaultTasksExportFilters({
        statusMode: "all",
        starred: "only",
      }),
    );
    expect(result.map((t) => t.id)).toEqual(["a"]);

    const filed = filterTasksForExport(
      tasks,
      createDefaultTasksExportFilters({
        statusMode: "all",
        folderFilter: "f1",
      }),
    );
    expect(filed.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("buildTasksExportRows", () => {
  it("maps task fields into export columns", () => {
    const folders: TaskFolder[] = [
      {
        id: "f1",
        workspaceId: "w1",
        name: "Ops",
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const rows = buildTasksExportRows(
      [
        makeTask({
          title: "File taxes",
          description: "Bring W2",
          starred: true,
          folderId: "f1",
          dueDate: "2026-04-15",
          assignee: "You",
        }),
      ],
      folders,
      { t1: { count: 2, latestAt: "2026-01-02T00:00:00.000Z", latestUserId: "u1" } },
    );
    expect(rows[0]).toMatchObject({
      Important: "Yes",
      Title: "File taxes",
      Folder: "Ops",
      Due: "2026-04-15",
      Notes: "Bring W2",
      Comments: 2,
      Assignee: "You",
    });
  });
});
