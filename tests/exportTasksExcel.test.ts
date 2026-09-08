import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  buildTasksExportRows,
  createDefaultTasksExportFilters,
  filterTasksForExport,
} from "@/features/tasks/lib/exportTasksExcel";
import { parseCSVToTasks, tasksToCSV } from "@/lib/utils";
import { startOfLocalToday, toDueDateStorage } from "@/lib/datetime";
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

  it("filters hot list to past due, today, and tomorrow", () => {
    const today = startOfLocalToday();
    const dated = [
      makeTask({ id: "overdue", dueDate: toDueDateStorage(addDays(today, -1)) }),
      makeTask({ id: "today", dueDate: toDueDateStorage(today) }),
      makeTask({ id: "tomorrow", dueDate: toDueDateStorage(addDays(today, 1)) }),
      makeTask({ id: "later", dueDate: toDueDateStorage(addDays(today, 4)) }),
      makeTask({ id: "undated" }),
      makeTask({ id: "starred", starred: true }),
    ];
    const result = filterTasksForExport(
      dated,
      createDefaultTasksExportFilters({
        statusMode: "all",
        hotList: "only",
      }),
    );
    expect(result.map((t) => t.id)).toEqual(["overdue", "today", "tomorrow", "starred"]);
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

  it("captures every user-facing task attribute", () => {
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
    const notes = [
      {
        id: "n1",
        title: "W2 scan",
        content: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        tags: [],
        workspaceId: "w1",
        linkedTaskIds: ["t1"],
      },
    ];
    const [row] = buildTasksExportRows(
      [
        makeTask({
          id: "t1",
          title: "File taxes",
          description: "Bring W2",
          status: "doing",
          priority: "P0",
          starred: true,
          folderId: "f1",
          dueDate: "2026-04-15T00:00:00.000Z",
          createdAt: "2026-01-01T12:00:00.000Z",
          completedAt: "2026-04-16T18:00:00.000Z",
          assignee: "You",
          assigneeIds: ["u-you"],
          tags: ["finance", "annual"],
          recurringRule: "FREQ=YEARLY",
          exceptionDates: ["2025-04-15"],
          linkedNoteIds: ["n1", "n-missing"],
          timeEstimate: 90,
          parentTaskId: "t-parent",
          notebookId: "nb1",
          notebookName: "Tax notebook",
        }),
      ],
      folders,
      { t1: { count: 2, latestAt: "2026-01-02T00:00:00.000Z", latestUserId: "u1" } },
      { notes },
    );

    expect(row).toEqual({
      Id: "t1",
      Title: "File taxes",
      Notes: "Bring W2",
      Status: "In progress",
      Priority: "Urgent",
      Important: "Yes",
      Folder: "Ops",
      Due: "2026-04-15",
      Created: "2026-01-01T12:00:00.000Z",
      Completed: "2026-04-16T18:00:00.000Z",
      Repeat: "Yearly",
      "Repeat rule": "FREQ=YEARLY",
      "Skipped dates": "2025-04-15",
      Assignee: "You",
      "Assignee IDs": "u-you",
      Tags: "finance; annual",
      "Linked files": "W2 scan; n-missing",
      Comments: 2,
      "Time estimate": 90,
      "Parent task": "t-parent",
      Notebook: "Tax notebook",
    });
  });
});

describe("tasksToCSV", () => {
  it("round-trips every persisted task attribute", () => {
    const csv = tasksToCSV([
      makeTask({
        id: "t1",
        title: "File taxes",
        description: "Bring W2",
        status: "doing",
        priority: "P0",
        starred: true,
        folderId: "f1",
        dueDate: "2026-04-15",
        createdAt: "2026-01-01T12:00:00.000Z",
        completedAt: "2026-04-16T18:00:00.000Z",
        assignee: "You",
        assigneeIds: ["u-you"],
        tags: ["finance", "annual"],
        recurringRule: "FREQ=YEARLY",
        exceptionDates: ["2025-04-15"],
        linkedNoteIds: ["n1"],
        timeEstimate: 90,
        parentTaskId: "t-parent",
        notebookId: "nb1",
        notebookName: "Tax notebook",
      }),
    ]);

    expect(csv.split("\n")[0]).toBe(
      "id,title,description,status,priority,dueDate,createdAt,completedAt,starred,folderId,assignee,assigneeIds,tags,recurringRule,exceptionDates,linkedNoteIds,timeEstimate,parentTaskId,notebookId,notebookName",
    );

    const [parsed] = parseCSVToTasks(csv);
    expect(parsed).toMatchObject({
      id: "t1",
      title: "File taxes",
      description: "Bring W2",
      status: "doing",
      priority: "P0",
      starred: true,
      folderId: "f1",
      dueDate: "2026-04-15",
      createdAt: "2026-01-01T12:00:00.000Z",
      completedAt: "2026-04-16T18:00:00.000Z",
      assignee: "You",
      assigneeIds: ["u-you"],
      tags: ["finance", "annual"],
      recurringRule: "FREQ=YEARLY",
      exceptionDates: ["2025-04-15"],
      linkedNoteIds: ["n1"],
      timeEstimate: 90,
      parentTaskId: "t-parent",
      notebookId: "nb1",
      notebookName: "Tax notebook",
    });
  });
});
