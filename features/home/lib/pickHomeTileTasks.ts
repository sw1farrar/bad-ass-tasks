import {
  isDueDatePast,
  isDueDateToday,
  parseLocalDate,
  startOfLocalToday,
} from "@/lib/datetime";
import { isDueDateTomorrow } from "./buildUpcomingFocus";
import type { HomeFocusItem } from "./buildAttentionItems";
import type { WorkspaceDueTaskGroups } from "./groupWorkspaceDueTasks";

export const HOME_TILE_TASK_ROWS = 5;
export const HOME_TILE_TASK_COLS = 2;
export const HOME_TILE_TASK_SLOTS = HOME_TILE_TASK_ROWS * HOME_TILE_TASK_COLS;

/** Single assignee column on shared workspace tiles (Me / Anyone). */
export const HOME_TILE_COLUMN_ROWS = 5;

export const HOME_TILE_ME_SECTION_LABEL = "Me";
export const HOME_TILE_ALL_SECTION_LABEL = "Anyone";

export type HomeTileTaskBucket =
  | "late"
  | "today"
  | "tomorrow"
  | "upcoming"
  | "undated";

export type HomeTileTask = {
  item: HomeFocusItem;
  bucket: HomeTileTaskBucket;
};

function dueTime(item: HomeFocusItem): number {
  return parseLocalDate(item.task.dueDate || "")?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function compareChronological(a: HomeFocusItem, b: HomeFocusItem): number {
  const aDue = dueTime(a);
  const bDue = dueTime(b);
  if (aDue !== bDue) return aDue - bDue;
  return a.task.title.localeCompare(b.task.title, undefined, { sensitivity: "base" });
}

export function getHomeTileTaskBucket(
  item: HomeFocusItem,
  reference = startOfLocalToday(),
): HomeTileTaskBucket {
  const dueDate = item.task.dueDate;
  if (!dueDate) return "undated";
  if (isDueDatePast(dueDate, reference)) return "late";
  if (isDueDateToday(dueDate, reference)) return "today";
  if (isDueDateTomorrow(dueDate, reference)) return "tomorrow";
  return "upcoming";
}

export function flattenWorkspaceDueTaskGroups(
  groups: WorkspaceDueTaskGroups,
): HomeFocusItem[] {
  return [
    ...groups.late,
    ...groups.today,
    ...groups.tomorrow,
    ...groups.upcoming,
    ...groups.undated,
  ];
}

/** All open tasks, oldest due date first. */
export function buildSortedHomeTileTasks(
  groups: WorkspaceDueTaskGroups,
  reference = startOfLocalToday(),
): HomeTileTask[] {
  const sorted = [...flattenWorkspaceDueTaskGroups(groups)].sort(compareChronological);

  return sorted.map((item) => ({
    item,
    bucket: getHomeTileTaskBucket(item, reference),
  }));
}

/** Oldest due date first, capped for the home tile grid. */
export function pickHomeTileTasks(
  groups: WorkspaceDueTaskGroups,
  maxSlots = HOME_TILE_TASK_SLOTS,
): HomeTileTask[] {
  return buildSortedHomeTileTasks(groups).slice(0, maxSlots);
}

export function countHomeTileDue(groups: WorkspaceDueTaskGroups): number {
  return flattenWorkspaceDueTaskGroups(groups).length;
}