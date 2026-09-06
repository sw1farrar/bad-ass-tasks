import type { Task } from "@/types";
import { normalizeFolderFilter, type TasksFolderFilterMode } from "@/features/tasks/lib/folderFilter";

export const TASK_LIST_PAGE_SIZE = 100;

export type TaskListStatusMode = "all" | "incomplete" | "completed";
export type TaskListRecurrenceMode = "all" | "only" | "none";

export type TaskListPageState = {
  rows: Task[];
  cursor: string | null;
  hasMore: boolean;
  total: number | null;
  loading: boolean;
  queryKey: string;
};

export const EMPTY_TASK_LIST_PAGE: TaskListPageState = {
  rows: [],
  cursor: null,
  hasMore: false,
  total: null,
  loading: false,
  queryKey: "",
};

export function resolveTaskStatusMode(filter: {
  statusMode?: TaskListStatusMode;
  recurring?: string;
}): TaskListStatusMode {
  if (filter.statusMode === "all" || filter.statusMode === "incomplete" || filter.statusMode === "completed") {
    return filter.statusMode;
  }
  if (filter.recurring === "completed") return "completed";
  if (filter.recurring === "all") return "all";
  return "incomplete";
}

export function resolveTaskRecurrenceMode(filter: {
  recurrenceMode?: TaskListRecurrenceMode;
  recurring?: string;
}): TaskListRecurrenceMode {
  if (filter.recurrenceMode === "only" || filter.recurrenceMode === "none" || filter.recurrenceMode === "all") {
    return filter.recurrenceMode;
  }
  if (filter.recurring === "only") return "only";
  if (filter.recurring === "none") return "none";
  return "all";
}

export function buildTaskListQueryKey(input: {
  workspaceId: string;
  statusMode: TaskListStatusMode;
  search?: string;
  starred?: "all" | "only";
  recurrence?: TaskListRecurrenceMode;
  folderFilter?: TasksFolderFilterMode;
}): string {
  const folders = normalizeFolderFilter(input.folderFilter).slice().sort();
  return [
    input.workspaceId,
    input.statusMode,
    (input.search ?? "").trim().toLowerCase(),
    input.starred ?? "all",
    input.recurrence ?? "all",
    folders.join(","),
  ].join("|");
}

export function mergeTaskListRows(primary: Task[], extra: Task[]): Task[] {
  if (!extra.length) return primary;
  const ids = new Set(primary.map((t) => t.id));
  const out = primary.slice();
  for (const row of extra) {
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    out.push(row);
  }
  return out;
}

export function formatTaskListCount(loaded: number, total?: number | null): string {
  if (total != null && total > loaded) {
    return `${loaded.toLocaleString()} of ${total.toLocaleString()}`;
  }
  return `${loaded.toLocaleString()} shown`;
}

/** Escape a user search string for PostgREST `ilike`. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
