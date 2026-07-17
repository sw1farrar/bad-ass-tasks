import { countOpenAndOverdueTasks } from "@/features/home/lib/computeWorkspaceTaskStats";
import { countPendingReviewForWorkspace } from "@/lib/files/fileFilters";
import type { Task, WorkspaceTaskStats } from "@/types";

export type WorkspaceNavFocusItem = {
  task: Task;
  workspaceId: string;
  workspaceName?: string;
};

/** Merge workspace tasks from list + Home focus slices (deduped by id). */
export function mergeWorkspaceTasksForNavCounts(
  workspaceId: string,
  tasks: Task[],
  globalTodayFocus: WorkspaceNavFocusItem[],
  globalOpenTaskFocus: WorkspaceNavFocusItem[],
): Task[] {
  const merged = new Map<string, Task>();
  for (const item of globalTodayFocus) {
    if (item.workspaceId === workspaceId) merged.set(item.task.id, item.task);
  }
  for (const item of globalOpenTaskFocus) {
    if (item.workspaceId === workspaceId) merged.set(item.task.id, item.task);
  }
  for (const task of tasks) {
    if (task.workspaceId === workspaceId) merged.set(task.id, task);
  }
  return [...merged.values()];
}

export function getWorkspaceNavTaskCounts(input: {
  workspaceId: string;
  tasks: Task[];
  globalTodayFocus: WorkspaceNavFocusItem[];
  globalOpenTaskFocus: WorkspaceNavFocusItem[];
  globalWorkspaceStats?: Record<string, WorkspaceTaskStats>;
  /**
   * When true (workspace tasks hydrated), always derive counts from local slices —
   * including empty → 0 — so complete/delete clear the badge instantly.
   * When false (still booting), fall back to aggregate stats if local slices are empty.
   */
  preferLocalTasks?: boolean;
}): { openCount: number; overdueCount: number } {
  const wsTasks = mergeWorkspaceTasksForNavCounts(
    input.workspaceId,
    input.tasks,
    input.globalTodayFocus,
    input.globalOpenTaskFocus,
  );
  if (wsTasks.length > 0 || input.preferLocalTasks) {
    return countOpenAndOverdueTasks(wsTasks);
  }
  const stats = input.globalWorkspaceStats?.[input.workspaceId];
  return {
    openCount: stats?.openCount ?? 0,
    overdueCount: stats?.overdueCount ?? 0,
  };
}

export function getWorkspacePendingReviewCount(notes: { workspaceId?: string; reviewStatus?: string }[], workspaceId: string): number {
  return countPendingReviewForWorkspace(notes as Parameters<typeof countPendingReviewForWorkspace>[0], workspaceId);
}