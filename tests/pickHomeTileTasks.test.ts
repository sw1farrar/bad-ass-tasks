import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { startOfLocalToday } from "@/lib/datetime";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";
import {
  countHomeTileDue,
  HOME_TILE_TASK_SLOTS,
  pickHomeTileTasks,
} from "@/features/home/lib/pickHomeTileTasks";
import { groupWorkspaceDueTasks } from "@/features/home/lib/groupWorkspaceDueTasks";

function item(id: string, dueDate?: string): HomeFocusItem {
  return {
    workspaceId: "ws-1",
    workspaceName: "Test",
    task: {
      id,
      title: `Task ${id}`,
      status: "todo",
      priority: "P2",
      workspaceId: "ws-1",
      ...(dueDate !== undefined ? { dueDate } : {}),
    } as HomeFocusItem["task"],
  };
}

describe("pickHomeTileTasks", () => {
  const today = startOfLocalToday();
  const yesterday = addDays(today, -1).toISOString().slice(0, 10);
  const twoDaysAgo = addDays(today, -2).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = addDays(today, 1).toISOString().slice(0, 10);
  const nextWeekIso = addDays(today, 7).toISOString().slice(0, 10);

  it("includes all open dated tasks, oldest first, capped at twelve", () => {
    const groups = groupWorkspaceDueTasks(
      [
        item("late-new", yesterday),
        item("late-old", twoDaysAgo),
        item("today", todayIso),
        item("tmr", tomorrowIso),
        item("future", nextWeekIso),
        item("today-2", todayIso),
      ],
      today,
    );

    const picked = pickHomeTileTasks(groups);
    expect(picked).toHaveLength(6);
    expect(picked[0].item.task.id).toBe("late-old");
    expect(picked[1].item.task.id).toBe("late-new");
    expect(picked[2].item.task.id).toBe("today");
    expect(picked[3].item.task.id).toBe("today-2");
    expect(picked[4].item.task.id).toBe("tmr");
    expect(picked[5].item.task.id).toBe("future");
  });

  it("caps the flat grid at HOME_TILE_TASK_SLOTS", () => {
    const tasks = Array.from({ length: 14 }, (_, i) =>
      item(`t-${i}`, addDays(today, i).toISOString().slice(0, 10)),
    );
    const groups = groupWorkspaceDueTasks(tasks, today);
    expect(pickHomeTileTasks(groups)).toHaveLength(HOME_TILE_TASK_SLOTS);
  });

  it("places undated tasks after dated tasks", () => {
    const groups = groupWorkspaceDueTasks(
      [item("undated"), item("today", todayIso), item("late", yesterday)],
      today,
    );
    const picked = pickHomeTileTasks(groups);
    expect(picked.map((t) => t.item.task.id)).toEqual(["late", "today", "undated"]);
    expect(picked[2].bucket).toBe("undated");
  });

  it("countHomeTileDue includes every open task bucket", () => {
    const groups = groupWorkspaceDueTasks(
      [
        item("1", yesterday),
        item("2", todayIso),
        item("3", tomorrowIso),
        item("4", nextWeekIso),
        item("5"),
      ],
      today,
    );
    expect(countHomeTileDue(groups)).toBe(5);
  });
});