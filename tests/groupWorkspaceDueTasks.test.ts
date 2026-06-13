import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { groupWorkspaceDueTasks, countDueTasks } from "@/features/home/lib/groupWorkspaceDueTasks";
import { startOfLocalToday } from "@/lib/datetime";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";

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

describe("groupWorkspaceDueTasks", () => {
  const today = startOfLocalToday();
  const yesterday = addDays(today, -1).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = addDays(today, 1).toISOString().slice(0, 10);
  const nextWeekIso = addDays(today, 7).toISOString().slice(0, 10);

  it("buckets late, today, tomorrow, upcoming, and undated", () => {
    const groups = groupWorkspaceDueTasks(
      [
        item("a", yesterday),
        item("b", todayIso),
        item("c", tomorrowIso),
        item("d", nextWeekIso),
        item("e"),
      ],
      today,
    );
    expect(groups.late).toHaveLength(1);
    expect(groups.today).toHaveLength(1);
    expect(groups.tomorrow).toHaveLength(1);
    expect(groups.upcoming).toHaveLength(1);
    expect(groups.undated).toHaveLength(1);
    expect(countDueTasks(groups)).toBe(5);
  });
});