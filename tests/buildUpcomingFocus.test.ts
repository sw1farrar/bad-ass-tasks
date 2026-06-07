import { describe, it, expect } from "vitest";
import {
  buildGlobalOpenTaskFocus,
  buildGlobalUpcomingFocus,
  isTaskDueTodayOrTomorrow,
  isTaskOverdueTodayOrTomorrow,
  sortOpenTaskFocusItems,
  sortUpcomingFocusItems,
} from "@/features/home/lib/buildUpcomingFocus";
import { startOfLocalToday, toDueDateStorage } from "@/lib/datetime";
import { addDays } from "date-fns";
import type { Task } from "@/types";

const today = startOfLocalToday();
const tomorrow = addDays(today, 1);

const task = (id: string, due: Date, priority: Task["priority"]): Task =>
  ({
    id,
    title: `Task ${id}`,
    workspaceId: "ws1",
    status: "todo",
    dueDate: toDueDateStorage(due),
    priority,
    tags: [],
    createdAt: new Date().toISOString(),
    description: "",
    linkedNoteIds: [],
  }) as Task;

describe("isTaskDueTodayOrTomorrow", () => {
  it("matches today and tomorrow only", () => {
    expect(isTaskDueTodayOrTomorrow(toDueDateStorage(today))).toBe(true);
    expect(isTaskDueTodayOrTomorrow(toDueDateStorage(tomorrow))).toBe(true);
    expect(isTaskDueTodayOrTomorrow(toDueDateStorage(addDays(today, 2)))).toBe(false);
    expect(isTaskDueTodayOrTomorrow(toDueDateStorage(addDays(today, -1)))).toBe(false);
  });
});

describe("isTaskOverdueTodayOrTomorrow", () => {
  it("matches past due, today, and tomorrow", () => {
    expect(isTaskOverdueTodayOrTomorrow(toDueDateStorage(addDays(today, -2)))).toBe(true);
    expect(isTaskOverdueTodayOrTomorrow(toDueDateStorage(today))).toBe(true);
    expect(isTaskOverdueTodayOrTomorrow(toDueDateStorage(tomorrow))).toBe(true);
    expect(isTaskOverdueTodayOrTomorrow(toDueDateStorage(addDays(today, 2)))).toBe(false);
  });
});

describe("sortUpcomingFocusItems", () => {
  it("orders today before tomorrow, then priority", () => {
    const items = [
      { task: task("t3", tomorrow, "P0"), workspaceId: "ws1", workspaceName: "A" },
      { task: task("t1", today, "P2"), workspaceId: "ws1", workspaceName: "A" },
      { task: task("t2", today, "P0"), workspaceId: "ws1", workspaceName: "A" },
    ];
    const sorted = sortUpcomingFocusItems(items);
    expect(sorted.map((i) => i.task.id)).toEqual(["t2", "t1", "t3"]);
  });
});

describe("buildGlobalUpcomingFocus", () => {
  it("collects open tasks due today or tomorrow across workspaces", () => {
    const result = buildGlobalUpcomingFocus(
      [
        { id: "ws1", name: "One" },
        { id: "ws2", name: "Two" },
      ],
      (wsId) =>
        wsId === "ws1"
          ? [task("a", today, "P1"), task("b", addDays(today, 5), "P0")]
          : [task("c", tomorrow, "P2")],
      12,
      today,
    );
    expect(result.map((i) => i.task.id)).toEqual(["a", "c"]);
  });
});

describe("buildGlobalOpenTaskFocus", () => {
  it("includes overdue, today, and tomorrow only — not undated or far future", () => {
    const overdue = task("late", addDays(today, -3), "P2");
    const undated = { ...task("open", today, "P1"), dueDate: undefined };
    const future = task("later", addDays(today, 10), "P0");
    const dueToday = task("today", today, "P0");

    const result = buildGlobalOpenTaskFocus(
      [{ id: "ws1", name: "One" }],
      () => [overdue, undated, future, dueToday],
      16,
      today,
    );

    expect(result.map((i) => i.task.id)).toEqual(["late", "today"]);
  });
});

describe("sortOpenTaskFocusItems", () => {
  it("orders overdue before today and tomorrow", () => {
    const items = [
      { task: task("tomorrow", tomorrow, "P0"), workspaceId: "ws1", workspaceName: "A" },
      { task: task("overdue", addDays(today, -2), "P2"), workspaceId: "ws1", workspaceName: "A" },
      { task: task("today", today, "P1"), workspaceId: "ws1", workspaceName: "A" },
    ];
    expect(sortOpenTaskFocusItems(items, today).map((i) => i.task.id)).toEqual([
      "overdue",
      "today",
      "tomorrow",
    ]);
  });
});