import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { startOfLocalToday } from "@/lib/datetime";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";
import { groupWorkspaceDueTasks } from "@/features/home/lib/groupWorkspaceDueTasks";
import {
  isHomeTileTaskAssignedToMe,
  isHomeTileTaskUnassigned,
  pickHomeTileTaskSections,
} from "@/features/home/lib/pickHomeTileTaskSections";
import {
  HOME_TILE_ALL_SECTION_LABEL,
  HOME_TILE_COLUMN_ROWS,
  HOME_TILE_ME_SECTION_LABEL,
} from "@/features/home/lib/pickHomeTileTasks";

function item(
  id: string,
  dueDate: string,
  extras: Partial<HomeFocusItem["task"]> = {},
): HomeFocusItem {
  return {
    workspaceId: "ws-1",
    workspaceName: "Test",
    task: {
      id,
      title: `Task ${id}`,
      status: "todo",
      priority: "P2",
      workspaceId: "ws-1",
      dueDate,
      ...extras,
    } as HomeFocusItem["task"],
  };
}

describe("pickHomeTileTaskSections", () => {
  const today = startOfLocalToday();
  const yesterday = addDays(today, -1).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const currentUserId = "u-me";

  const members = [
    {
      workspaceId: "ws-1",
      userId: "u-me",
      role: "owner" as const,
      joinedAt: "",
      fullName: "Casey Owner",
    },
    {
      workspaceId: "ws-1",
      userId: "u-rachel",
      role: "member" as const,
      joinedAt: "",
      fullName: "Rachel Kim",
    },
    {
      workspaceId: "ws-1",
      userId: "u-steve",
      role: "member" as const,
      joinedAt: "",
      fullName: "Steve Lopez",
    },
  ];

  it("detects tasks assigned to the current user", () => {
    expect(
      isHomeTileTaskAssignedToMe(
        item("mine", todayIso, { assigneeIds: [currentUserId] }).task,
        currentUserId,
      ),
    ).toBe(true);
    expect(
      isHomeTileTaskAssignedToMe(
        item("legacy", todayIso, { assignee: "You" }).task,
        currentUserId,
      ),
    ).toBe(true);
  });

  it("maps Anyone-pool tasks to the Anyone bucket only", () => {
    const task = item("pool", todayIso, { assignee: "Anyone" }).task;
    expect(isHomeTileTaskUnassigned(task, members, currentUserId)).toBe(true);
    expect(
      isHomeTileTaskUnassigned(
        item("legacy-all", todayIso, { assignee: "All" }).task,
        members,
        currentUserId,
      ),
    ).toBe(true);
    expect(
      isHomeTileTaskUnassigned(
        item("legacy", todayIso, { assignee: "Unassigned" }).task,
        members,
        currentUserId,
      ),
    ).toBe(true);
    expect(
      isHomeTileTaskUnassigned(
        item("rachel", todayIso, { assigneeIds: ["u-rachel"], assignee: "Rachel" }).task,
        members,
        currentUserId,
      ),
    ).toBe(false);
  });

  it("returns Me and Anyone columns in order, excluding other assignees", () => {
    const groups = groupWorkspaceDueTasks(
      [
        item("all-1", todayIso),
        item("me-late", yesterday, { assigneeIds: [currentUserId], assignee: "You" }),
        item("rachel-1", yesterday, { assigneeIds: ["u-rachel"], assignee: "Rachel" }),
        item("steve-1", todayIso, { assigneeIds: ["u-steve"], assignee: "Steve" }),
        item("all-2", todayIso),
        item("me-today", todayIso, { assigneeIds: [currentUserId], assignee: "You" }),
      ],
      today,
    );

    const sections = pickHomeTileTaskSections(groups, members, currentUserId);
    expect(sections.map((s) => s.label)).toEqual([
      HOME_TILE_ME_SECTION_LABEL,
      HOME_TILE_ALL_SECTION_LABEL,
    ]);
    expect(sections[0].tasks.map((t) => t.item.task.id)).toEqual(["me-late", "me-today"]);
    expect(sections[1].tasks.map((t) => t.item.task.id)).toEqual(["all-1", "all-2"]);
  });

  it("omits empty Me or Anyone columns", () => {
    const onlyMe = groupWorkspaceDueTasks(
      [item("me-1", todayIso, { assigneeIds: [currentUserId], assignee: "You" })],
      today,
    );
    expect(pickHomeTileTaskSections(onlyMe, members, currentUserId).map((s) => s.label)).toEqual([
      HOME_TILE_ME_SECTION_LABEL,
    ]);

    const onlyAll = groupWorkspaceDueTasks([item("all-1", todayIso)], today);
    expect(pickHomeTileTaskSections(onlyAll, members, currentUserId).map((s) => s.label)).toEqual([
      HOME_TILE_ALL_SECTION_LABEL,
    ]);
  });

  it("caps each column at six tasks", () => {
    const tasks = Array.from({ length: HOME_TILE_COLUMN_ROWS + 2 }, (_, i) =>
      item(`me-${i}`, todayIso, { assigneeIds: [currentUserId], assignee: "You" }),
    );
    const groups = groupWorkspaceDueTasks(tasks, today);
    const sections = pickHomeTileTaskSections(groups, members, currentUserId);
    expect(sections[0].tasks).toHaveLength(HOME_TILE_COLUMN_ROWS);
  });
});