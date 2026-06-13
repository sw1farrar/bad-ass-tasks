import type { Task } from "@/types";
import type { HomeFocusItem } from "./buildAttentionItems";
import {
  pickAllOpenTasksFromWorkspace,
  sortHomeTileTasksChronologically,
} from "./buildUpcomingFocus";

/** Merge cached focus slices + store tasks, then return all open tasks for one workspace. */
export function buildWorkspaceDueTasks(
  workspaceId: string,
  workspaceName: string,
  storeTasks: Task[],
  globalOpenTaskFocus: HomeFocusItem[],
  globalTodayFocus: HomeFocusItem[],
): HomeFocusItem[] {
  const merged = new Map<string, Task>();

  for (const item of globalTodayFocus) {
    if (item.workspaceId === workspaceId) merged.set(item.task.id, item.task);
  }
  for (const item of globalOpenTaskFocus) {
    if (item.workspaceId === workspaceId) merged.set(item.task.id, item.task);
  }
  for (const task of storeTasks) {
    if (task.workspaceId === workspaceId) merged.set(task.id, task);
  }

  return sortHomeTileTasksChronologically(
    pickAllOpenTasksFromWorkspace(
      [...merged.values()],
      workspaceId,
      workspaceName,
    ),
  );
}