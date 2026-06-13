import { isAllAssigneePool } from "@/lib/assignee";
import type { Task, WorkspaceMember } from "@/types";
import type { WorkspaceDueTaskGroups } from "./groupWorkspaceDueTasks";
import {
  HOME_TILE_ALL_SECTION_LABEL,
  HOME_TILE_COLUMN_ROWS,
  HOME_TILE_ME_SECTION_LABEL,
  type HomeTileTask,
  buildSortedHomeTileTasks,
} from "./pickHomeTileTasks";

export type HomeTileTaskSection = {
  key: string;
  label: string;
  tasks: HomeTileTask[];
};

export function isHomeTileTaskAssignedToMe(
  task: Task,
  currentUserId?: string,
): boolean {
  if (!currentUserId) return task.assignee === "You";
  const primaryId = task.assigneeIds?.find(Boolean);
  if (primaryId) return primaryId === currentUserId;
  return task.assignee === "You";
}

export function isHomeTileTaskUnassigned(
  task: Task,
  _members: WorkspaceMember[],
  currentUserId?: string,
): boolean {
  if (isHomeTileTaskAssignedToMe(task, currentUserId)) return false;
  return isAllAssigneePool(task.assigneeIds, task.assignee);
}

/** Me (left) + Anyone pool (right); excludes other assignees. Each column capped at six rows. */
export function pickHomeTileTaskSections(
  groups: WorkspaceDueTaskGroups,
  members: WorkspaceMember[],
  currentUserId?: string,
  maxSlotsPerColumn = HOME_TILE_COLUMN_ROWS,
): HomeTileTaskSection[] {
  const sorted = buildSortedHomeTileTasks(groups);
  const meTasks: HomeTileTask[] = [];
  const allTasks: HomeTileTask[] = [];

  for (const tileTask of sorted) {
    const task = tileTask.item.task;

    if (isHomeTileTaskAssignedToMe(task, currentUserId)) {
      if (meTasks.length < maxSlotsPerColumn) meTasks.push(tileTask);
      continue;
    }

    if (isHomeTileTaskUnassigned(task, members, currentUserId)) {
      if (allTasks.length < maxSlotsPerColumn) allTasks.push(tileTask);
    }
  }

  const columns: HomeTileTaskSection[] = [];
  if (meTasks.length > 0) {
    columns.push({
      key: "me",
      label: HOME_TILE_ME_SECTION_LABEL,
      tasks: meTasks,
    });
  }
  if (allTasks.length > 0) {
    columns.push({
      key: "all",
      label: HOME_TILE_ALL_SECTION_LABEL,
      tasks: allTasks,
    });
  }

  return columns;
}